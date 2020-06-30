'use strict'

const path = require('path')
const fs = require('fs')
const glob = require('glob')
const _ = require('lodash')
const yaml = require('./yaml')


/**
 * resolve $includes directive.
 * @param doc {object}
 * @param baseDir {string}
 */
function resolveIncludes(doc, baseDir) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  processComponents()
  processPaths()

  // revert cwd
  process.chdir(cwd)
}

/**
 * process files in components directory.
 */
function processComponents() {
  const filePaths = glob.sync('components/**/*.yml')
  for (const f of filePaths) {
    let obj = yaml.readYAML(f)
    obj = replaceIncludes(obj, path.dirname(f), '')
    yaml.writeYAML(obj, f)
  }
}

/**
 * process files in paths directory.
 */
function processPaths() {
  const filePaths = glob.sync('paths/**/*.yml')
  for (const f of filePaths) {
    let obj = yaml.readYAML(f)
    obj = replaceIncludes(obj, path.dirname(f), '')
    yaml.writeYAML(obj, f)
  }
}


/**
 * replace $include with its file content.
 * @param doc {object}
 * @param baseDir {string}
 * @param relativeDir {string}
 * @returns {[]|{}|*}
 */
function replaceIncludes(doc, baseDir, relativeDir) {
  // base case
  if (!_.isObject(doc)) {
    return doc
  }
  let ret = _.isArray(doc) ? [] : {}
  for (const [key, val] of Object.entries(doc)) {
    if (key === '$ref') {
      // update ref
      ret[key] = path.join(relativeDir, val)

    } else if (key.startsWith('$include')) {
      // include file
      const targetFilePath = path.join(relativeDir, val)
      const targetObj = yaml.readYAML(path.join(baseDir, targetFilePath))
      // recursively $include YAML
      const resolvedObj = replaceIncludes(targetObj, baseDir, path.dirname(targetFilePath))
      ret = _.merge(ret, resolvedObj)

    } else {
      // replace children
      ret[key] = replaceIncludes(val, baseDir, relativeDir)
    }
  }

  return ret
}


module.exports = resolveIncludes
