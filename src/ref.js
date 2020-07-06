"use strict";

const _ = require("lodash");
const url = require("url");
const { extname: pathExtName } = require("path");

/**
 * Search reference fields in given object.
 * @param obj {object}
 * @param callback {function} function called when any reference found
 */
function searchRef(obj, callback) {
  if (!_.isObject(obj)) {
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "$ref") {
      obj[key] = callback(key, val);
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          val.mapping[mkey] = callback(mkey, mval);
        }
      }
    } else {
      searchRef(val, callback);
    }
  }
}

/**
 * Async version of searchRef.
 * @param obj
 * @param callback
 * @returns {Promise<void>}
 */
async function searchRefAsync(obj, callback) {
  if (!_.isObject(obj)) {
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "$ref") {
      obj[key] = await callback(key, val);
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          val.mapping[mkey] = await callback(mkey, mval);
        }
      }
    } else {
      await searchRefAsync(val, callback);
    }
  }
}

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
    const { protocol, href, path, hash } = url.parse(ref);
    this.protocol = protocol;
    this.href = href;
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
  searchRef,
  searchRefAsync,
  sliceObject,
};
