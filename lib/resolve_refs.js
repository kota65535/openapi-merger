'use strict'

const path = require('path')
const glob = require('glob')
const _ = require('lodash')
const yaml = require('./yaml')

/**
 * resolve $refs.
 * @param doc {object}
 * @param baseDir {string}
 */
function resolveRefs(doc, baseDir) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  processComponents(doc)
  processPaths(doc)

  // revert cwd
  process.chdir(cwd)

  return doc
}

/**
 * process components section.
 * @param doc {object}
 * @returns {*}
 */
function processComponents(doc) {
  const COMPONENTS_DIR = 'components'
  const filePaths = glob.sync('**/*.yml', { cwd: COMPONENTS_DIR })
  let children = {}
  for (const f of filePaths) {
    const componentName = f.split(path.sep)[0]
    const schemaName = path.basename(f, path.extname(f))
    if (schemaName.startsWith('_')) {
      continue
    }
    children[componentName] = children[componentName] || {}
    if (children[componentName][schemaName]) {
      console.warn(`$.${COMPONENTS_DIR}.${componentName}.${schemaName} already exists.`)
    }

    let obj = yaml.readYAML(path.join(COMPONENTS_DIR, f))
    obj = replaceRefs(obj, path.dirname(path.join(COMPONENTS_DIR, f)))
    children[componentName][schemaName] = obj
  }
  // merge object
  return Object.assign(doc[COMPONENTS_DIR], children)
}

/**
 * process paths section.
 * @param doc {object}
 * @returns {*}
 */
function processPaths(doc) {
  const PATHS_DIR = 'paths'
  const filePaths = glob.sync('**/*.yml', { cwd: PATHS_DIR })
  let children = {}
  for (const f of filePaths) {
    let obj = yaml.readYAML(path.join(PATHS_DIR, f))
    obj = replaceRefs(obj, PATHS_DIR)
    for (const [key, val] of Object.entries(obj)) {
      if (children[key]) {
        console.warn(`$.${PATHS_DIR}.${key} already exists.`)
      }
      children[key] = val
    }
  }
  // merge object
  return Object.assign(doc[PATHS_DIR], children)
}

/**
 * replace remote refs to local refs to be created.
 * @param doc {object}
 * @param dir {string}
 * @returns {*}
 */
function replaceRefs(doc, dir) {
  // base case
  if (!_.isObject(doc)) {
    return doc
  }
  let ret = _.clone(doc)
  for (const [key, val] of Object.entries(doc)) {
    if (key === '$ref') {
      ret[key] = convertPathToHash(path.join(dir, val))
    } else {
      ret[key] = replaceRefs(val, dir)
    }
  }
  return ret
}


function convertPathToHash(filePath) {
  if (filePath.startsWith('components')) {
    const filePathWoExt = filePath.substring(0, filePath.length - path.extname(filePath).length)
    const tok = filePathWoExt.split(path.sep)
    if (tok.length > 3) {
      return '#/' + path.join(tok[0], tok[1], tok[tok.length - 1])
    }
    return '#/' + filePathWoExt
  }
  return filePath
}


module.exports = resolveRefs
