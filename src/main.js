"use strict";

const path = require("path");
const yaml = require("./yaml");
const Merger = require("./merger");

async function main(params) {
  const inputDir = path.dirname(params.input);
  try {
    let doc = await yaml.readYAML(params.input);

    const merger = new Merger();
    doc = await merger.merge(doc, inputDir);

    yaml.writeYAML(doc, params.output);
  } catch (e) {
    // show error message
    if (params.debug) {
      console.error(e);
    } else {
      console.error("Error :" + e.message);
    }
  }
}

module.exports = main;
