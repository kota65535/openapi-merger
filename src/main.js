"use strict";

const yaml = require("./yaml");
const Merger = require("./merger");

async function main(params) {
  try {
    let doc = await yaml.readYAML(params.input);

    const merger = new Merger();
    doc = await merger.merge(doc, params.input);

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
