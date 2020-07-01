'use strict'

const program = require('commander')
const merger = require('../src/merger')


program
    .version(require('../package.json').version)
    .usage('[-h] [-i file] [-o dir] [--debug]')
    .description('include OpenAPI files, just support YAML.')
    .requiredOption('-i, --input <*.yaml|yml file>',
        'input a main/entry YAML OpenAPI file',
        /^.+\.(yaml|yml)$/gi)
    .requiredOption('-o, --output <*.yaml|yml file>',
        'output OpenAPI file',
        /^.+\.(yaml|yml)$/gi)
    .option('--debug', 'debug mode, such as print error tracks', false)
    .action((args) => {
        const params = {
            input: args.input,
            output: args.output,
            debug: args.debug
        }
        console.debug('params: ', params)

        merger(params)
    })

program.parse(process.argv)


