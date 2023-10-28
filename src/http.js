"use strict";

const fetch = require("node-fetch");
const _ = require("lodash");
const { loadYAML } = require("./yaml");
const log = require("loglevel");

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

  log.warn(`fetching: ${url}`);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    log.error(`Failed to fetch: ${url}`);
    return {};
  }
  if (!res.ok) {
    log.error(`${res.status} returned: ${url}`);
    return {};
  }

  const body = await res.text();
  let doc;
  if (url.match(/\.(yml|yaml)$/)) {
    doc = loadYAML(body);
  } else if (url.match(/\.json$/)) {
    doc = JSON.parse(body);
  } else {
    log.warn(`Cannot determine the file type: ${url}`);
    // assume YAML for now
    doc = loadYAML(body);
  }

  cache[url] = doc;

  return _.cloneDeep(doc);
}

module.exports = {
  download,
};
