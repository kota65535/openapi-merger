"use strict";

const _ = require("lodash");
const url = require("url");
const { extname: pathExtName } = require("path");

/**
 * Slice object based on the URL hash (fragment).
 * @param obj {object}
 * @param hash {string}
 * @returns {object}
 */
function sliceObject(obj, hash) {
  if (!hash || !hash.startsWith("#")) {
    return obj;
  }
  hash = hash.substr(1);
  hash.split("/").every((k) => {
    obj = Object.getOwnPropertyDescriptor(obj, k).value;
    return obj;
  });
  return obj;
}

function parseRef(ref) {
  return new ParsedRef(ref);
}

class ParsedRef {
  constructor(ref) {
    const { protocol, host, href, path, hash } = url.parse(ref);
    this.protocol = protocol;
    this.host = host;
    this.href = href.replace(hash, "");
    this.path = path;
    this.ext = path ? pathExtName(this.path) : null;
    this.hash = hash;
  }

  isLocal() {
    return !this.path;
  }

  isRemote() {
    return this.path;
  }

  isHttp() {
    return this.protocol && this.protocol.match(/^(http|https):/);
  }
}

module.exports = {
  parseRef,
  sliceObject,
};
