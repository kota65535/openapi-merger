"use strict";

const fetch = require("node-fetch");
const _ = require("lodash");
const { loadYAML } = require("./yaml");

const cache = {};

/**
 * Download from URL.
 * @param url {string}
 * @returns
 */
async function download(url) {
  if (cache[url]) {
    return _.cloneDeep(cache[url]);
  }

  console.info(`fetching: ${url}`);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error(`Failed to fetch: ${url}`);
    return {};
  }
  if (!res.ok) {
    console.error(`${res.status} returned: ${url}`);
    return {};
  }

  const body = await res.text();
  let doc;
  if (url.match(/\.(yml|yaml)$/)) {
    doc = loadYAML(body);
  } else if (url.match(/\.json$/)) {
    doc = JSON.parse(body);
  } else {
    console.warn(`Cannot determine the file type: ${url}`);
    // assume YAML for now
    doc = loadYAML(body);
  }

  cache[url] = doc;

  return _.cloneDeep(doc);
}

module.exports = {
  download,
};
