#!/usr/bin/env node
"use strict";

const program = require("commander");
const main = require("../src/main");

function validate(val, pattern, message) {
  if (val.match(pattern)) {
    return val;
  }
  console.error("error: " + message);
  process.exit(1);
}

program
  .version(require("../package.json").version)
  .usage("-i <file> [-o <file>] [-c <config-file>]")
  .description("merge OpenAPI files into a single file. just support YAML.")
  .requiredOption("-i, --input <*.yml|yaml file>", "input a main/entry YAML OpenAPI file", (val) =>
    validate(val, /^.+\.(yml|yaml)$/gi, 'input file must be "*.(yml|yaml)"')
  )
  .option("-o, --output <*.yml|yaml file>", "output OpenAPI file", (val) =>
    validate(val, /^.+\.(yml|yaml)$/gi, 'output file must be "*.(yml|yaml)"')
  )
  .option("-c, --config <*.yml|yaml file>", "configuration file")
  .option("--debug", "debug mode, such as print error tracks", false)
  .action(async (args) => {
    const params = {
      input: args.input,
      output: args.output,
      config: args.config,
      debug: args.debug,
    };
    if (params.debug) {
      console.debug("params: ", params);
    }

    try {
      await main(params);
    } catch (e) {
      // show error message
      if (params.debug) {
        console.error(e);
      } else {
        console.error("Error :" + e.message);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
