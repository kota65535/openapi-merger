"use strict";

const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");

function readYAML(filePath) {
  const str = "" + fs.readFileSync(filePath, "utf8");
  return yaml.safeLoad(str);
}

function writeYAML(doc, filePath) {
  const outputDir = path.dirname(filePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.info("writing: " + filePath);
  const dump = yaml.dump(doc);
  fs.writeFileSync(filePath, dump);
}

module.exports = {
  readYAML,
  writeYAML,
};
