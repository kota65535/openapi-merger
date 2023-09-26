"use strict";

const Url = require("url");
const _ = require("lodash");
const deepmerge = require("deepmerge");

function sliceObject(obj, hash) {
  if (!hash) {
    return obj;
  }
  const path = hash.substr(2);
  try {
    path.split("/").every((k) => {
      k = escapeJsonPointer(k);
      const desc = Object.getOwnPropertyDescriptor(obj, k);
      if (!desc.value) {
        throw new Error(`cannot get key ${k} from ${obj}`);
      }
      obj = desc.value;
      return obj;
    });
  } catch (e) {
    throw new Error(`invalid hash '${hash}'`);
  }
  return obj;
}

function parseUrl(url) {
  // this converts to posix path (separated by '/') if windows path (separated by '\') is given
  const ret = Url.parse(url);
  ret.isLocal = !ret.path && ret.hash;
  ret.isHttp = ret.protocol && ret.protocol.match(/^(http|https):/);
  if (ret.hash) {
    ret.hrefWoHash = ret.href.replace(ret.hash, "");
    // for windows
    ret.hash = ret.hash.replace(/%5C/g, "/");
  } else {
    ret.hrefWoHash = ret.href;
  }
  return ret;
}

function filterObject(obj, keyPattern) {
  if (!keyPattern) {
    return obj;
  }
  const ret = {};
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
  const ret = {};
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
  const ret = {};
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

// Special class to distinguish $include-ed array and normal one
class IncludedArray extends Array {}

module.exports = {
  sliceObject,
  parseUrl,
  filterObject,
  appendObjectKeys,
  prependObjectKeys,
  mergeOrOverwrite,
  IncludedArray,
};
