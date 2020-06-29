'use strict'

const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')
const resolve = require('./resolve')


function resolver (param) {
  const inputBaseDir = path.dirname(param.input)
  let q = [param.input]
  let filesWrote = {}

  while (q.length > 0) {
    let filePath = q[0]

    if (q.every(i => filesWrote[i])) {
      break
    }

    if (filesWrote[filePath]) {
      q.shift()
      continue
    }

    console.debug('processing: ' + filePath)

    const orig = readFile(filePath)

    const obj = resolve(orig, path.dirname(filePath), '.', q)

    writeFile(obj, param.outputDir, path.relative(inputBaseDir, filePath))

    filesWrote[filePath] = true

    q.shift()
  }
}

function readFile(filePath) {
  const str = '' + fs.readFileSync(filePath, 'utf8')
  return yaml.safeLoad(str)
}


function writeFile(obj, outputBaseDir, filePath) {
  const outputPath = path.join(outputBaseDir, filePath)
  const outputDir = path.dirname(outputPath)
  if (! fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  console.info('writing: ' + outputPath)
  const dump = yaml.dump(obj)
  fs.writeFileSync(outputPath, dump)
}


module.exports = resolver
