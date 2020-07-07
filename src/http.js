"use strict";

const crypto = require("crypto");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");
const { writeYAML, loadYAML } = require("./yaml");

/**
 * Download from URL.
 * @param parsed {object} object returned by url.parse()
 * @param dir {string}
 * @returns
 */
async function download(parsed, dir = ".") {
  const baseName = crypto.createHash("md5").update(parsed.href).digest("hex");
  const filePath = path.join(dir, `${baseName}${parsed.ext}`);
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
  return { doc, filePath };
}

module.exports = {
  download,
};
