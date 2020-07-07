"use strict";

const fetch = require("node-fetch");
const { writeYAML, loadYAML } = require("./yaml");

/**
 * Download from URL.
 * @param parsed {object} object returned by url.parse()
 * @param filePath {string}
 * @returns
 */
async function download(parsed, filePath) {
  console.info(`Fetching: ${parsed.href}`);
  const res = await fetch(parsed.href);
  const t = await res.text();
  let doc;
  if (parsed.ext.match(/\.(yml|yaml)$/)) {
    doc = loadYAML(t);
  }
  if (parsed.ext.match(/\.json$/)) {
    doc = JSON.parse(t);
  }
  writeYAML(doc, filePath);
  return doc;
}

module.exports = {
  download,
};
