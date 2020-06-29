'use strict'

const path = require('path')
const fs = require('fs')
const glob = require('glob')
const yaml = require('js-yaml')
const deepmerge = require('deepmerge')

const { isHTTP, isTmpDir, download } = require('./remote')
const { parseRef, sliceHashtag } = require('./reference')

function getRemoteRelativeRef(ref) {
  // parse ref
  let { protocol, filePath } = parseRef(ref)

  // URL ref
  if (isHTTP(protocol)) {
    return null
  }
  // local ref
  if (!filePath) {
    return null
  }
  // remote ref
  if (path.isAbsolute(filePath)) {
    return null
  }
  return filePath
}

/**
 * Resolve inclusion recursively.
 *
 * @param {string} obj
 * @param {string} baseDir
 * @param {string} currentDir
 * @param {object} q
 * @return {object} resolved object
 */
function resolve (obj, baseDir, currentDir, q) {
  // same return type as the input object
  let ret
  if (isObject(obj)) {
    ret = {}
  } else if (isArray(obj)) {
    ret = []
  } else {
    // base case
    return obj
  }

  for (const [key, ref] of Object.entries(obj)) {
    // discriminator mapping ref
    if (key === 'discriminator') {
      ret[key] = ref
      for (const [mapKey, mapRef] of Object.entries(ref['mapping'])) {
          const relativeRef = getRemoteRelativeRef(mapRef)
          if (!relativeRef) {
            continue
          }
          const filePath = path.join(currentDir, relativeRef)
          console.debug('discriminator ref from: ' + baseDir + ', to: ' + filePath)
          q.push(path.join(baseDir, filePath))
      }
      continue
    }
    // ref
    if (key === '$ref') {
      const relativeRef = getRemoteRelativeRef(ref)
      if (!relativeRef) {
        obj[key] = ref
        continue
      }
      const filePath = path.join(currentDir, relativeRef)
      ret[key] = filePath
      console.debug('ref from: ' + baseDir + ', to: ' + filePath)
      q.push(path.join(baseDir, filePath))
      continue
    }

    // merge child object
    if (!key.startsWith('$include')) {
      const child = resolve(ref, baseDir, currentDir, q)
      if (isObject(ret[key]) && isObject(child)) {
        ret[key] = mergeObjects(ret[key], child, true)
      } else {
        ret[key] = child
      }
      continue
    }

    // parse ref
    let { protocol, filePath, hashtag } = parseRef(ref)

    // URL ref
    if (isHTTP(protocol)) {
      // temporary file path for saving remote file
      ret[key] = download(tag, filePath) + (hashtag ? ('#' + hashtag) : '')
      continue
    }
    // local ref
    if (!filePath) {
      ret[key] = ref
      continue
    }
    // remote ref, handling relative path
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(baseDir, currentDir, filePath)
    }
    // handle glob file names
    if (filePath.indexOf('*') >= 0) {
      // glob
      const entries = glob.sync(filePath)
      let globObj = {}
      for (let i = 0; i < entries.length; i++) {
        const schemaName = path.basename(entries[i], path.extname(entries[i]))
        if (schemaName.startsWith('_')) {
          continue
        }
        const schemaPath = path.relative(path.join(baseDir, currentDir), entries[i])
        globObj[schemaName] = { '$include': schemaPath }
      }
      globObj = resolve(globObj, baseDir, currentDir, q)
      // merge ref object
      ret = mergeObjects(ret, globObj, true)
      continue
    }

    // read the file contents.
    try {
      fs.accessSync(filePath, fs.R_OK)
    } catch (e) {
      console.error('error: "' + ref + '" does not exist.')
      continue
    }
    let fileContent = '' + fs.readFileSync(filePath)
    if (!fileContent) {
      if (!isTmpDir(ref)) console.error('error: "' + ref + '" should not be empty.')
      continue
    }

    let parsedContent = yaml.safeLoad(fileContent)
    let refObj = sliceHashtag(parsedContent, hashtag)
    let dirName = path.relative(baseDir, path.dirname(filePath))
    // ref object merged its children
    refObj = resolve(refObj, baseDir, dirName, q)
    // initialize ret as empty array if the first $ref is array
    if (isEmptyObject(ret) && isArray(refObj)) {
      ret = []
    }
    // merge ref object
    ret = mergeObjects(ret, refObj, true)
  }
  return ret
}

function mergeObjects (obj1, obj2, isDeepMerge) {
  if (isDeepMerge) {
    return deepmerge(obj1, obj2)
  } else {
    if (isArray(obj1)) {
      return obj1.concat(obj2)
    } else {
      return Object.assign({}, obj1, obj2)
    }
  }
}

function isEmptyObject (obj) {
  return isObject(obj) && Object.keys(obj).length === 0
}

function isObject (obj) {
  return obj && obj.constructor.name === 'Object'
}

function isArray (obj) {
  return obj && obj.constructor.name === 'Array'
}

module.exports = resolve
