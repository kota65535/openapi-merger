"use strict";

const { readYAML } = require("./yaml");
const { searchRef, searchRefAsync, sliceObject } = require("./ref");
const glob = require("glob");
const path = require("path");
const { parseRef } = require("./ref");
const { download } = require("./http");

const COMPONENTS_DIR = "components";
const FETCHED_DIR = "fetched";

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
    await resolveUrlRefs(components);
    resolveRemoteRefs(components);
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

/**
 * Resolve URL refs, with fetching from the URL.
 * @param components {array<Component>}
 * @returns {Promise<void>}
 */
async function resolveUrlRefs(components) {
  let promises = [];
  for (const c of components) {
    const promise = searchRefAsync(c.content, async (key, val) => {
      const parsed = parseRef(val);
      if (!parsed.isHttp()) {
        return val;
      }
      // http URL ref
      const filePath = await download(parsed, FETCHED_DIR);
      return `${filePath}${parsed.hash || ""}`;
    });
    promises.push(promise);
  }
  await Promise.all(promises);
}

/**
 * Resolve $ref in components.
 */
function resolveRemoteRefs(components) {
  for (const c of components) {
    const dir = path.dirname(c.filePath);
    searchRef(c.content, (key, val) => {
      const parsed = parseRef(val);
      if (!parsed.isRemote()) {
        return val;
      }
      // fetched URL ref
      if (parsed.path.startsWith(FETCHED_DIR)) {
        return val;
      }
      // remote ref
      const p = path.join(dir, parsed.path);
      const referred = components.find((t) => t.filePath === p);
      if (!referred) {
        console.error(
          `Reference to "${val}" from "${c.filePath}" not resolved.`
        );
        return val;
      }
      return `${referred.getLocalRef()}${parsed.hash || ""}`;
    });
  }
}

class Component {
  constructor(filePath, hash, type, name) {
    this.filePath = filePath;
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
