"use strict";

const path = require("path");
const _ = require("lodash");
const { readYAML } = require("./yaml");
const { parseRef, sliceObject } = require("./ref");

const COMPONENTS_DIR = "components";

/**
 * Merge Operation objects into OpenAPI object (root).
 * @param doc {object}
 * @returns {*}
 */
function mergePathItems(doc) {
  doc.paths = doMergePathItems(doc.paths, "", 0);
  return doc;
}

function doMergePathItems(obj, currentDir, depth) {
  if (!_.isObject(obj)) {
    return obj;
  }
  // Operation object is 2 levels down from Paths object
  // $ref under Operation object is not merged in this step
  let shouldMerge = depth <= 2;
  let ret = _.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    ret[key] = val;
    if (key === "$ref" || key === "$include") {
      const parsed = parseRef(val);
      if (!parsed.isRemote()) {
        continue;
      }
      // Remote ref
      const filePath = path.join(currentDir, val);
      if (shouldMerge) {
        const sliced = sliceObject(readYAML(filePath), parsed.hash);
        const resolved = doMergePathItems(
          _.cloneDeep(sliced),
          path.dirname(filePath),
          depth
        );
        _.merge(ret, resolved);
        delete ret[key];
      } else {
        ret[key] = filePath;
      }
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          val.mapping[mkey] = path.join(currentDir, mval);
        }
      }
    } else {
      ret[key] = doMergePathItems(val, currentDir, depth + 1);
    }
  }
  return ret;
}

/**
 * Merge remote $refs.
 * @param doc {object} OpenAPI doc object
 * @param components {array<Component>}
 */
function mergeRefs(doc, components) {
  doc = _.cloneDeep(doc);
  doc = addComponents(doc, components);
  doc = doMergeRefs(doc, "", components);
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
      if (cmp && key === "$ref") {
        ret[key] = `${cmp.getLocalRef()}${parsed.hash || ""}`;
      } else {
        const sliced = sliceObject(readYAML(filePath), parsed.hash);
        const resolved = doMergeRefs(
          _.cloneDeep(sliced),
          path.dirname(filePath),
          components
        );
        _.merge(ret, resolved);
      }
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          const filePath = path.join(currentDir, mval);
          const cmp = components.find((c) => c.filePath === filePath);
          if (cmp) {
            val.mapping[mkey] = cmp.getLocalRef();
          }
        }
      }
      ret[key] = val;
    } else {
      ret[key] = doMergeRefs(val, currentDir, components);
    }
  }

  return ret;
}

module.exports = {
  mergePathItems,
  mergeRefs,
};
