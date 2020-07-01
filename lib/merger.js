'use strict'

const path = require('path')
const yaml = require('./yaml')
const fs = require('fs-extra')
const mktemp = require('mktemp')
const localizeRefs = require('./localize_refs')
const mergeRefs = require('./merge_refs')


async function merger(param) {

  let input, inputDir
  try {
    input = await prepare(param.input)
    inputDir = path.dirname(input)
    let doc = await yaml.readYAML(input)

    doc = localizeRefs(doc, inputDir)
    doc = mergeRefs(doc, inputDir)

    yaml.writeYAML(doc, param.output)
  } catch (e) {
    // delegate to top level
    throw e
  } finally {
    // remove temporary directory
    await fs.remove(inputDir)
    console.debug('removed temporary directory.')
  }
}


/**
 * create temporary working directory.
 * @param inputFile
 * @returns {Promise<*>}
 */
async function prepare(inputFile) {
  const tmpDir = await mktemp.createDir('XXXXX.tmp');
  console.debug(`temporary directory: ${tmpDir}`)

  const inputDir = path.dirname(inputFile)

  await Promise.all([
    fs.copy(inputFile, path.join(tmpDir, path.basename(inputFile))),
    fs.copy(path.join(inputDir, 'components'), path.join(tmpDir, 'components')),
    fs.copy(path.join(inputDir, 'paths'), path.join(tmpDir, 'paths'))
  ])
  return path.join(tmpDir, path.basename(inputFile))
}


module.exports = merger
