"use strict";

const path = require("path");
const _ = require("lodash");
const yaml = require("./yaml");
const { parseRef } = require("./ref");
const { sliceObject } = require("./ref");

const COMPONENTS_DIR = "components";

/**
 * Merge remote $refs.
 * @param doc {object} OpenAPI doc object
 * @param baseDir {string}
 * @param components {array<Component>}
 */
function mergeRefs(doc, baseDir, components) {
  // change cwd
  const cwd = process.cwd();
  process.chdir(baseDir);
  doc = _.cloneDeep(doc);

  try {
    doc = addComponents(doc, components);
    doc = doMergeRefs(doc, "", components);
  } finally {
    // revert cwd
    process.chdir(cwd);
  }
  return doc;
}

/**
 * Copy components under the root document object.
 * @param doc
 * @param components {array<Component>}
 */
function addComponents(doc, components) {
  doc = _.cloneDeep(doc);
  doc[COMPONENTS_DIR] = doc[COMPONENTS_DIR] || {};
  for (const c of components) {
    doc[COMPONENTS_DIR][c.type] = doc[COMPONENTS_DIR][c.type] || {};
    doc[COMPONENTS_DIR][c.type][c.name] = c.content;
  }
  return doc;
}

/**
 * Merge refs with its file content.
 * @param doc {object}
 * @param currentDir {string}
 * @param components {array<Component>}
 * @returns {object}
 */
function doMergeRefs(doc, currentDir, components) {
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

      // for remote ref
      const filePath = path.join(currentDir, parsed.path);
      const comp = components.find((c) => c.filePath === filePath);
      if (comp) {
        // component found, replace it by local ref
        ret[key] = `${comp.getLocalRef()}${parsed.hash || ""}`;
        continue;
      }

      // component not found, merge it
      const obj = sliceObject(yaml.readYAML(filePath), parsed.hash);
      const mergedObj = doMergeRefs(obj, path.dirname(filePath), components);
      ret = _.merge(ret, mergedObj);
    } else if (key === "$include") {
      const parsed = parseRef(val);
      let comp;
      if (parsed.isLocal()) {
        comp = components.find((c) => c.getLocalRef() === val);
      } else {
        const filePath = path.join(currentDir, parsed.path);
        comp = components.find((c) => c.filePath === filePath);
      }
      if (comp) {
        // component found, merge it
        _.merge(ret, comp.content);
      }
    } else {
      ret[key] = doMergeRefs(val, currentDir, components);
    }
  }

  return ret;
}

module.exports = mergeRefs;
