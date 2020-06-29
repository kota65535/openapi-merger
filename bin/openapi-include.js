'use strict'

const program = require('commander')
const path = require('path')
const fs = require('fs')
const resolver = require('../lib/resolver')

function validate(param) {
    const ext = path.extname(param.input).toLowerCase()
    if (!fs.existsSync(param.input)) {
        throw new Error(param.input + ' not found.')
    }
    if (ext !== '.yaml' && ext !== '.yml') {
        throw new Error('"-i/--input" file extension must be ".yaml" or ".yml"')
    }
    if (!fs.existsSync(param.outputDir)) {
        try {
            fs.mkdirSync(param.outputDir)
        } catch (e) {
            throw new Error('cannot create directory: ' + param.output)
        }
    }
    if (!fs.statSync(param.outputDir).isDirectory()) {
        throw new Error(param.output + ' is not a directory.')
    }
}

program
    .version(require('../package.json').version)
    .usage('[-h] [-i file] [-o dir] [--debug]')
    .description('include OpenAPI files, just support YAML.')
    .requiredOption('-i, --input <*.yaml|yml file>', 'input a main/entry YAML OpenAPI file')
    .requiredOption('-o, --output-dir <dir>', 'output directory of resolved OpenAPI files')
    .option('--debug', 'debug mode, such as print error tracks', false)
    .action((args) => {
        const options = {
            input: args.input,
            outputDir: args.outputDir,
            debug: args.debug
        }
        console.debug('options: ', options)
        try {
            validate(options)
            resolver(options)
        } catch (e) {
            if (options.debug) {
                console.error(e)
            } else {
                console.error('Error :' + e.message)
            }
        }
    })

program.parse(process.argv)


