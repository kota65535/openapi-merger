"use strict";

const crypto = require("crypto");
const fetch = require("node-fetch");
const path = require("path");
const { writeYAML, loadYAML } = require("./yaml");

/**
 * Download from URL.
 * @param parsed {object} object returned by url.parse()
 * @param dir {string}
 * @returns {Promise<string>}
 */
async function download(parsed, dir = ".") {
  const res = await fetch(parsed.href);
  const t = await res.text();
  const baseName = crypto.createHash("md5").update(t).digest("hex");
  let doc;
  if (parsed.ext.match(/\.(yml|yaml)$/)) {
    doc = loadYAML(t);
  }
  if (parsed.ext.match(/\.json$/)) {
    doc = JSON.parse(t);
  }
  const filePath = path.join(dir, `${baseName}${parsed.ext}`);
  writeYAML(doc, filePath);
  return filePath;
}

module.exports = {
  download,
};
