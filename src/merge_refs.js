'use strict'

const path = require('path')
const _ = require('lodash')
const yaml = require('./yaml')

const COMPONENTS_DIR = 'components'


/**
 * Merge remote $refs.
 * @param doc {object} OpenAPI doc object
 * @param baseDir {string}
 * @param components {array<Component>}
 */
function mergeRefs(doc, baseDir, components) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  try {
    doc = _.cloneDeep(doc)
    doc = addComponents(doc, components)
    doc = doMergeRefs(doc, "", components)
  } finally {
    // revert cwd
    process.chdir(cwd)
  }
  return doc
}

/**
 * Copy components under the root document object.
 * @param doc
 * @param components {array<Component>}
 */
function addComponents(doc, components) {
  doc = _.cloneDeep(doc)
  doc[COMPONENTS_DIR] = doc[COMPONENTS_DIR] || {}
  for (const c of components) {
    doc[COMPONENTS_DIR][c.type] = doc[COMPONENTS_DIR][c.type] || {}
    doc[COMPONENTS_DIR][c.type][c.name] = c.content
  }
  return doc
}

/**
 * Merge by replacing $refs with its file content.
 * @param doc {object}
 * @param relativeDir {string}
 * @param components {array<Component>}
 * @returns {object}
 */
function doMergeRefs(doc, relativeDir, components) {
  // base case
  if (!_.isObject(doc)) {
    return doc
  }
  let ret = _.isArray(doc) ? [] : {}
  for (const [key, val] of Object.entries(doc)) {
    if (key !== '$ref') {
      ret[key] = doMergeRefs(val, relativeDir, components)
      continue
    }

    // nothing to do for local ref
    if (val.startsWith('#')) {
      ret[key] = val
      continue
    }

    // remote ref
    const filePath = path.join(relativeDir, val)
    const c = components.find(c => c.filePath === filePath)
    if (c) {
      ret[key] = c.getLocalRef()
      continue
    }

    const targetObj = yaml.readYAML(filePath)
    // recursively $include YAML
    const resolvedObj = doMergeRefs(targetObj, path.dirname(filePath), components)
    ret = _.merge(ret, resolvedObj)
  }

  return ret
}


module.exports = mergeRefs
