'use strict'

const path = require('path')
const _ = require('lodash')
const yaml = require('./yaml')


/**
 * merge remote $refs.
 * @param doc {object}
 * @param baseDir {string}
 */
function mergeRefs(doc, baseDir) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  doc = _.cloneDeep(doc)
  doc = doMergeRefs(doc, '', '')

  // revert cwd
  process.chdir(cwd)

  return doc
}


/**
 * merge by replacing $refs with its file content.
 * @param doc {object}
 * @param baseDir {string}
 * @param relativeDir {string}
 * @returns {object}
 */
function doMergeRefs(doc, baseDir, relativeDir) {
  // base case
  if (!_.isObject(doc)) {
    return doc
  }
  let ret = _.isArray(doc) ? [] : {}
  for (const [key, val] of Object.entries(doc)) {
    if (key !== '$ref') {
      ret[key] = doMergeRefs(val, baseDir, relativeDir)
      continue
    }

    // nothing to do for local ref
    if (val.startsWith('#')) {
      ret[key] = val
      continue
    }

    const targetFilePath = path.join(relativeDir, val)
    const targetObj = yaml.readYAML(path.join(baseDir, targetFilePath))
    // recursively $include YAML
    const resolvedObj = doMergeRefs(targetObj, baseDir, path.dirname(targetFilePath))
    ret = _.merge(ret, resolvedObj)
  }

  return ret
}


module.exports = mergeRefs
