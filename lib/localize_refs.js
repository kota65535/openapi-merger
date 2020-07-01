'use strict'

const path = require('path')
const glob = require('glob')
const _ = require('lodash')
const yaml = require('./yaml')

const COMPONENTS_DIR = 'components'

/**
 * localize remote refs.
 * @param doc {object}
 * @param baseDir {string}
 * @returns {object}
 */
function localizeRefs(doc, baseDir) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  doc = localizeComponents(doc)
  localizeComponentRefs()

  // revert cwd
  process.chdir(cwd)

  return doc
}

/**
 * copy components under the root document object.
 * @param doc {object}
 * @returns {object}
 */
function localizeComponents(doc) {
  doc = _.cloneDeep(doc)

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
  return Object.assign({}, doc, {[COMPONENTS_DIR]: children})
}

/**
 * replace all remote refs for components into local refs.
 */
function localizeComponentRefs() {
  // TODO: currently, paths only
  const PATHS_DIR = 'paths'
  const filePaths = glob.sync('**/*.yml', { cwd: PATHS_DIR })
  for (const f of filePaths) {
    // exclude files that begin with '_'
    if (path.basename(f).startsWith('_')) {
      continue
    }
    let obj = yaml.readYAML(path.join(PATHS_DIR, f))
    obj = replaceRefs(obj, PATHS_DIR)
    yaml.writeYAML(obj, path.join(PATHS_DIR, f))
  }
}

/**
 * replace remote refs to local refs to be created.
 * @param doc {object}
 * @param dir {string}
 * @returns {object}
 */
function replaceRefs(doc, dir) {
  // base case
  if (!_.isObject(doc)) {
    return doc
  }
  let ret = _.cloneDeep(doc)
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
  if (filePath.startsWith(COMPONENTS_DIR)) {
    const filePathWoExt = filePath.substring(0, filePath.length - path.extname(filePath).length)
    const tok = filePathWoExt.split(path.sep)
    if (tok.length > 3) {
      return '#/' + path.join(tok[0], tok[1], tok[tok.length - 1])
    }
    return '#/' + filePathWoExt
  }
  return filePath
}


module.exports = localizeRefs
