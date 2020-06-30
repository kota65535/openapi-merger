'use strict'

const program = require('commander')
const resolver = require('../lib/resolver')


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
        const options = {
            input: args.input,
            output: args.output,
            debug: args.debug
        }
        console.debug('options: ', options)

        resolver(options).catch(e => {
            if (options.debug) {
                console.error(e)
            } else {
                console.error('Error :' + e.message)
            }
        })
    })

program.parse(process.argv)


