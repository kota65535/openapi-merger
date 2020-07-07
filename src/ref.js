"use strict";

const _ = require("lodash");
const url = require("url");
const { extname: pathExtName } = require("path");

/**
 * Search reference from the given object.
 * @param obj
 * @param callback
 * @returns {Promise<void>}
 */
async function searchRef(obj, callback) {
  if (!_.isObject(obj)) {
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "$ref") {
      // delete all keys, because $ref ignores all sibling elements.
      deleteAllKeys(obj);
      const newVal = await callback(key, val);
      if (newVal) {
        if (_.isObject(newVal)) {
          // replace obj by ref content
          _.merge(obj, newVal);
        } else {
          // replace $ref value
          obj[key] = newVal;
        }
      }
    } else if (key === "$include") {
      const newVal = await callback(key, val);
      if (newVal) {
        // merge ref content into the object, keeping all siblings.
        _.merge(obj, newVal);
        delete obj[key];
      }
    } else if (key === "discriminator") {
      if (_.isObject(val)) {
        for (const [mkey, mval] of Object.entries(val.mapping)) {
          const newVal = await callback(mkey, mval);
          if (newVal) {
            val.mapping[mkey] = newVal;
          }
        }
      }
    } else {
      await searchRef(val, callback);
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

function deleteAllKeys(obj) {
  Object.entries(obj).forEach(([k, v]) => delete obj[k]);
}

function parseRef(ref) {
  return new ParsedRef(ref);
}

class ParsedRef {
  constructor(ref) {
    const { protocol, href, path, hash } = url.parse(ref);
    this.protocol = protocol;
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
  searchRef,
  sliceObject,
};
