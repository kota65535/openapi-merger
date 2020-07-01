'use strict'

const path = require('path')
const _ = require('lodash')
const yaml = require('./yaml')


/**
 * Merge remote $refs.
 * @param doc {object}
 * @param baseDir {string}
 */
function mergeRefs(doc, baseDir) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  try {
    doc = _.cloneDeep(doc)
    doc = doMergeRefs(doc, '')
  } finally {
    // revert cwd
    process.chdir(cwd)
  }
  return doc
}


/**
 * Merge by replacing $refs with its file content.
 * @param doc {object}
 * @param relativeDir {string}
 * @returns {object}
 */
function doMergeRefs(doc, relativeDir) {
  // base case
  if (!_.isObject(doc)) {
    return doc
  }
  let ret = _.isArray(doc) ? [] : {}
  for (const [key, val] of Object.entries(doc)) {
    if (key !== '$ref') {
      ret[key] = doMergeRefs(val, relativeDir)
      continue
    }

    // nothing to do for local ref
    if (val.startsWith('#')) {
      ret[key] = val
      continue
    }

    const targetFilePath = path.join(relativeDir, val)
    const targetObj = yaml.readYAML(targetFilePath)
    // recursively $include YAML
    const resolvedObj = doMergeRefs(targetObj, path.dirname(targetFilePath))
    ret = _.merge(ret, resolvedObj)
  }

  return ret
}


module.exports = mergeRefs
