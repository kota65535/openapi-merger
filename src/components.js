"use strict";

const { readYAML } = require("./yaml");
const { sliceObject } = require("./ref");
const glob = require("glob");
const path = require("path");
const _ = require("lodash");
const { parseRef } = require("./ref");
const { download } = require("./http");
const fs = require("fs-extra");

const COMPONENTS_DIR = "components";

/**
 * Parse component directory.
 * @param baseDir {string}
 * @returns {array<Component>}
 */
async function createComponents(baseDir) {
  // change cwd
  const cwd = process.cwd();
  process.chdir(baseDir);

  try {
    let components = parseComponentDir();
    let fetched;
    do {
      await resolveRemoteRefs(components);
      fetched = await resolveUrlRefs(components);
      components = components.concat(fetched);
    } while (fetched.length > 0);
    return components;
  } finally {
    // revert cwd
    process.chdir(cwd);
  }
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
  let names = new Set();
  let conflicted = new Set();
  for (const f of filePaths) {
    const parsed = path.parse(f);
    const name = parsed.name;
    const type = parsed.dir.split(path.sep)[1];
    // check name conflict
    if (names.has(name)) {
      if (!conflicted.has(name)) {
        console.warn(
          `Component name conflicts. type: "${type}", name: "${name}"`
        );
      }
      conflicted.add(name);
    }
    names.add(name);
  }

  let components = [];
  for (const f of filePaths) {
    let name = path.basename(f, path.extname(f));
    components.push(
      Component.fromFilePath(f, { prependSubSir: conflicted.has(name) })
    );
  }
  return components;
}

async function resolveRemoteRefs(components) {
  for (let c of components) {
    c.content = await resolveRemoteRefsRecursively(
      c.content,
      path.dirname(c.filePath),
      components
    );
  }
}

async function resolveUrlRefs(components) {
  let fetchedComponents = [];
  for (let c of components) {
    await resolveUrlRefsRecursively(
      c.content,
      path.dirname(c.filePath),
      fetchedComponents
    );
  }
  return fetchedComponents;
}

async function resolveUrlRefsRecursively(doc, currentDir, fetched) {
  // base case
  if (!_.isObject(doc)) {
    return;
  }
  for (const [key, val] of Object.entries(doc)) {
    if (key === "$ref" || key === "$include") {
      const parsed = parseRef(val);
      if (parsed.isHttp()) {
        const dir = path.join(parsed.host, path.dirname(parsed.path));
        fs.mkdirpSync(dir);
        const filePath = path.join(dir, path.basename(parsed.path));
        await download(parsed, filePath);
        let name = path
          .join(parsed.path, parsed.hash.slice(1))
          .split("/")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join("");

        name = name.replace(path.extname(parsed.path), "");
        fetched.push(new Component(filePath, parsed.hash, "schemas", name));
        // fetched.push(
        //   Component.fromFilePath(filePath, {hash: parsed.hash, prependSubSir: true}))
        doc[key] = path.relative(currentDir, filePath);
      }
    } else {
      await resolveUrlRefsRecursively(val, currentDir, fetched);
    }
  }
}

async function resolveRemoteRefsRecursively(doc, currentDir, components) {
  // base case
  if (!_.isObject(doc)) {
    return doc;
  }
  let ret = _.isArray(doc) ? [] : {};
  for (const [key, val] of Object.entries(doc)) {
    if (key === "$ref") {
      const parsed = parseRef(val);
      // nothing to do for local ref
      if (parsed.isLocal()) {
        ret[key] = val;
        continue;
      }

      if (parsed.isHttp()) {
        ret[key] = val;
        continue;
      }

      // for remote ref
      const filePath = path.join(currentDir, parsed.path);
      const comp = components.find((c) => c.filePath === filePath);
      if (comp) {
        // component found, replace it by local ref
        ret[key] = `${comp.getLocalRef()}${parsed.hash || ""}`;
      }
    } else if (key === "$include") {
      const parsed = parseRef(val);
      // nothing to do for local ref
      if (parsed.isLocal()) {
        ret[key] = val;
        continue;
      }
      if (parsed.isHttp()) {
        // TODO: do something
        ret[key] = val;
        continue;
      }

      // for remote ref
      const filePath = path.join(currentDir, parsed.path);
      const comp = components.find((c) => c.filePath === filePath);
      if (comp) {
        // component found, replace it by local ref
        const mergedObj = await resolveRemoteRefsRecursively(
          _.cloneDeep(comp.content),
          path.dirname(filePath),
          components
        );
        const obj = sliceObject(mergedObj, parsed.hash);
        ret = _.merge(ret, obj);
      }
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          const filePath = path.join(currentDir, mval);
          const comp = components.find((c) => c.filePath === filePath);
          if (comp) {
            val.mapping[mkey] = comp.getLocalRef();
          }
        }
      }
      ret[key] = val;
    } else {
      ret[key] = await resolveRemoteRefsRecursively(
        val,
        currentDir,
        components
      );
    }
  }

  return ret;
}

class Component {
  constructor(filePath, hash, type, name) {
    this.filePath = filePath;
    this.hash = hash;
    this.type = type;
    this.name = name;
    this.content = sliceObject(readYAML(filePath), hash);
  }

  static fromFilePath(filePath, { hash = "", prependSubSir = false } = {}) {
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
  }

  getLocalRef() {
    return `#/${COMPONENTS_DIR}/${this.type}/${this.name}`;
  }
}

module.exports = {
  createComponents,
  Component,
};
