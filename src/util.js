"use strict";

const Url = require("url");
const _ = require("lodash");
const deepmerge = require("deepmerge");

function sliceObject(obj, hash) {
  if (!hash || !hash.startsWith("#")) {
    return obj;
  }
  hash = hash.substr(2);
  if (hash) {
    hash.split("/").every((k) => {
      k = escapeJsonPointer(k);
      obj = Object.getOwnPropertyDescriptor(obj, k).value;
      return obj;
    });
  }
  return obj;
}

function parseUrl(url) {
  // this converts to posix path (separated by '/') if windows path (separated by '\') is given
  let ret = Url.parse(url);
  ret.isLocal = !ret.path && ret.hash;
  ret.isHttp = ret.protocol && ret.protocol.match(/^(http|https):/);
  ret.hrefWoHash = ret.href.replace(ret.hash, "");
  if (ret.hash) {
    // for windows
    ret.hash = ret.hash.replace(/%5C/g, "/");
  }
  return ret;
}

function filterObject(obj, keyPattern) {
  if (!keyPattern) {
    return obj;
  }
  let ret = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key.match(keyPattern)) {
      ret[key] = val;
    }
  }
  return ret;
}

function appendObjectKeys(obj, str) {
  if (!str) {
    return obj;
  }
  let ret = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = `${str}${key}`;
    ret[newKey] = val;
  }
  return ret;
}

function prependObjectKeys(obj, str) {
  if (!str) {
    return obj;
  }
  let ret = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = `${key}${str}`;
    ret[newKey] = val;
  }
  return ret;
}

function escapeJsonPointer(str) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "~" && i < str.length - 1) {
      switch (str[i + 1]) {
        case "0":
          out += "~";
          break;
        case "1":
          out += "/";
          break;
        default:
          throw new Error(`invalid escape sequence '~${str[i + 1]}'`);
      }
      i++;
    } else {
      out += str[i];
    }
  }
  return out;
}

function mergeOrOverwrite(v1, v2) {
  if (_.isObject(v1) && _.isObject(v2)) {
    return deepmerge(v1, v2);
  } else {
    return v2;
  }
}

module.exports = {
  sliceObject,
  parseUrl,
  filterObject,
  appendObjectKeys,
  prependObjectKeys,
  mergeOrOverwrite,
};
