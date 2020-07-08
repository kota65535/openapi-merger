"use strict";

const glob = require("glob");
const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const { readYAML } = require("./yaml");
const { sliceObject } = require("./ref");
const { parseRef } = require("./ref");
const { download } = require("./http");

const COMPONENTS_DIR = "components";
const FETCHED_DIR = "fetched";

/**
 * Create All Component instances necessary for this OpenAPI document.
 * @param doc {object}
 * @returns {array<Component>}
 */
async function createComponents(doc) {
  // parse and create components
  let components = parseComponentDir();
  let fetched = await resolveUrlRefsInPathItems(doc);
  components = components.concat(fetched);

  // resolve refs
  fetched = [];
  do {
    resolveRemoteRefs(components);
    fetched = await resolveUrlRefs(components);
    components = components.concat(fetched);
  } while (fetched.length > 0);

  return components;
}

/**
 * Create component instances from files in "components" directory.
 * Basically, component name corresponds to its file name.
 * If name conflicts, subdirectory names are prepended to the file name. For example:
 *
 * - /components/schemas/foo/Cat.yml -> FooCat
 * - /components/schemas/bar/Cat.yml -> BarCat
 *
 * @returns {array<Component>}
 */
function parseComponentDir() {
  const filePaths = glob.sync(`${COMPONENTS_DIR}/**/*.@(yml|yaml)`);
  let registered = new Set();
  let conflicted = new Set();

  function parseComponentName(filePath) {
    const parsed = path.parse(filePath);
    const type = parsed.dir.split(path.sep)[1];
    const name = parsed.name;
    return { type, name };
  }

  for (const f of filePaths) {
    const { type, name } = parseComponentName(f);
    const tn = `${type}${name}`;
    // check name conflict
    if (registered.has(tn)) {
      if (!conflicted.has(tn)) {
        console.warn(
          `Component name conflicts. type: "${type}", name: "${name}"`
        );
      }
      conflicted.add(tn);
    }
    registered.add(tn);
  }

  let components = [];
  for (const f of filePaths) {
    const { type, name } = parseComponentName(f);
    const tn = `${type}${name}`;
    if (name.startsWith("_")) {
      continue;
    }
    components.push(
      Component.fromFilePath(f, { prependSubSir: conflicted.has(tn) })
    );
  }
  return components;
}

/**
 * Resolve remote refs in components.
 * @param components {array<Component>}
 */
function resolveRemoteRefs(components) {
  for (let c of components) {
    const currentDir = path.dirname(c.filePath);
    c.content = doResolveRemoteRefs(c.content, currentDir, components);
  }
}

/**
 * Resolves remote refs in the given document.
 * @param doc {object}
 * @param currentDir {string}
 * @param components {array<Component>}
 * @returns {object}
 */
function doResolveRemoteRefs(doc, currentDir, components) {
  // base case
  if (!_.isObject(doc)) {
    return doc;
  }
  let ret = _.isArray(doc) ? [] : {};
  for (const [key, val] of Object.entries(doc)) {
    if (key === "$ref" || key === "$include") {
      const parsed = parseRef(val);
      // nothing to do here for local & URL ref
      if (!parsed.isRemote()) {
        ret[key] = val;
        continue;
      }

      // for remote ref
      const filePath = path.join(currentDir, parsed.path);
      const cmp = components.find((c) => c.filePath === filePath);
      if (cmp) {
        if (key === "$ref") {
          ret[key] = `${cmp.getLocalRef()}${parsed.hash || ""}`;
        }
        if (key === "$include") {
          const sliced = sliceObject(cmp.content, parsed.hash);
          const resolved = doResolveRemoteRefs(
            _.cloneDeep(sliced),
            path.dirname(filePath),
            components
          );
          _.merge(ret, resolved);
        }
      } else {
        console.warn(`Remote ref not resolved. path: ${filePath}`);
        ret[key] = val;
      }
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          const filePath = path.join(currentDir, mval);
          const cmp = components.find((c) => c.filePath === filePath);
          if (cmp) {
            val.mapping[mkey] = cmp.getLocalRef();
          } else {
            if (currentDir.startsWith(FETCHED_DIR)) {
              const parsed = filePathToUrl(path.join(currentDir, mval));
              val.mapping[mkey] = parsed.href;
            }
          }
        }
      }
      ret[key] = val;
    } else {
      ret[key] = doResolveRemoteRefs(val, currentDir, components);
    }
  }

  return ret;
}

async function resolveUrlRefsInPathItems(doc) {
  const fetchedComponents = [];
  await doResolveUrlRefs(doc, "", fetchedComponents);
  return fetchedComponents;
}

async function resolveUrlRefs(components) {
  const fetchedComponents = [];
  const promises = [];
  for (let c of components) {
    const currentDir = path.dirname(c.filePath);
    promises.push(doResolveUrlRefs(c.content, currentDir, fetchedComponents));
  }
  await Promise.all(promises);
  return fetchedComponents;
}

async function doResolveUrlRefs(doc, currentDir, fetched) {
  // base case
  if (!_.isObject(doc)) {
    return;
  }
  for (const [key, val] of Object.entries(doc)) {
    if (key === "$ref" || key === "$include") {
      const parsed = parseRef(val);
      if (parsed.isHttp()) {
        const cmp = await Component.fromURL(parsed);
        fetched.push(cmp);
        doc[key] = path.relative(currentDir, cmp.filePath);
      }
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          const parsed = parseRef(mval);
          if (parsed.isHttp()) {
            const cmp = await Component.fromURL(parsed);
            fetched.push(cmp);
            doc[key] = path.relative(currentDir, cmp.filePath);
          }
        }
      }
    } else {
      await doResolveUrlRefs(val, currentDir, fetched);
    }
  }
}

class Component {
  constructor(filePath, hash, type, name) {
    this.filePath = filePath;
    this.hash = hash;
    this.type = type;
    this.name = name;
    this.content = sliceObject(readYAML(filePath), hash);
  }

  static fromURL = async (parsed) => {
    const filePath = urlToFilePath(parsed);
    const dir = path.dirname(filePath);
    await fs.mkdirp(dir);
    await download(parsed, filePath);
    const name = nameFromUrl(parsed);
    return new Component(filePath, parsed.hash, "schemas", name);
  };

  static fromFilePath = (
    filePath,
    { hash = "", prependSubSir = false } = {}
  ) => {
    const parsed = path.parse(filePath);
    const dirParts = parsed.dir.split(path.sep);
    const type = dirParts[1];
    let name = parsed.name;
    if (prependSubSir) {
      const joinedParts = dirParts
        .slice(2, dirParts.length)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");
      name = joinedParts + parsed.name;
      console.info(`Using component name: "${name}" for file: "${filePath}"`);
    }
    return new Component(filePath, hash, type, name);
  };

  getLocalRef = () => {
    return `#/${COMPONENTS_DIR}/${this.type}/${this.name}`;
  };
}

function urlToFilePath(parsed) {
  return path.join(FETCHED_DIR, parsed.protocol, parsed.host, parsed.path);
}

function filePathToUrl(filePath) {
  const dirParts = filePath.split(path.sep);
  const url = `${dirParts[1]}//${dirParts.slice(2).join("/")}`;
  return parseRef(url);
}

function nameFromUrl(parsed) {
  const p = parsed.path.slice(0, -parsed.ext.length);
  let name = path.join(parsed.host, p, parsed.hash.slice(1));
  name = name.replace(/([\W][\w])/g, (group) =>
    group.toUpperCase().replace(/\W/, "")
  );
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return name;
}

module.exports = {
  createComponents,
  Component,
};
