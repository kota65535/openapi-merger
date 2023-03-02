"use strict";

const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");
const log = require("loglevel");

function loadYAML(str) {
  return yaml.load(str);
}

function readYAML(filePath) {
  const str = "" + fs.readFileSync(filePath, "utf8");
  return yaml.load(str);
}

function writeYAML(doc, filePath) {
  const dump = yaml.dump(doc, { lineWidth: 1000 });
  if (filePath) {
    const outputDir = path.dirname(filePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(filePath, dump);
  } else {
    log.info(dump);
  }
}

module.exports = {
  readYAML,
  writeYAML,
  loadYAML,
};
