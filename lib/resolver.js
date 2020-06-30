'use strict'

const path = require('path')
const yaml = require('./yaml')
const resolveRefs = require('./resolve_refs')
const resolveIncludes = require('./resolve_include')
const fs = require('fs-extra')
const mktemp = require('mktemp')

async function resolver(param) {

  let input, inputDir
  try {
    input = await prepare(param.input)
    inputDir = path.dirname(input)
    let doc = await yaml.readYAML(input)

    resolveIncludes(doc, inputDir)
    resolveRefs(doc, inputDir)

    yaml.writeYAML(doc, param.output)
  } catch (e) {
    // delegate to top level
    throw e
  } finally {
    // remove temporary directory
    await fs.remove(inputDir)
  }
}


/**
 * create temporary working directory.
 * @param inputFile
 * @returns {Promise<*>}
 */
async function prepare(inputFile) {
  const tmpDir = await mktemp.createDir('XXXXX.tmp');

  const inputDir = path.dirname(inputFile)

  await Promise.all([
    fs.copy(inputFile, path.join(tmpDir, path.basename(inputFile))),
    fs.copy(path.join(inputDir, 'components'), path.join(tmpDir, 'components')),
    fs.copy(path.join(inputDir, 'paths'), path.join(tmpDir, 'paths'))
  ])
  return path.join(tmpDir, path.basename(inputFile))
}


module.exports = resolver
