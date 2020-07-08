"use strict";

const url = require("url");
const path = require("path");

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
    const u = url.parse(ref);
    this.protocol = u.protocol;
    this.host = u.host;
    this.href = u.href.replace(u.hash, "");
    this.path = u.path;
    this.ext = u.path ? path.extname(this.path) : null;
    this.hash = u.hash || "";
  }

  isLocal() {
    return !this.path && this.hash;
  }

  isRemote() {
    return !this.isHttp() && this.path;
  }

  isHttp() {
    return this.protocol && this.protocol.match(/^(http|https):/);
  }
}

module.exports = {
  parseRef,
  sliceObject,
};
