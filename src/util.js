"use strict";

const Url = require("url");
const Path = require("path");

function sliceObject(obj, hash) {
  if (!hash || !hash.startsWith("#")) {
    return obj;
  }
  hash = hash.substr(2);
  hash.split("/").every((k) => {
    k = escapeJsonPointer(k);
    let desc = Object.getOwnPropertyDescriptor(obj, k);
    if (desc) {
      obj = desc.value;
    } else {
      console.error(`sliceObject failed`);
      console.error(obj);
      console.error(k);
    }
    return obj;
  });
  return obj;
}

function parseUrl(url) {
  let ret = Url.parse(url);
  ret.isLocal = !ret.path && ret.hash;
  ret.isHttp = ret.protocol && ret.protocol.match(/^(http|https):/);
  ret.hrefWoHash = ret.href.replace(ret.hash, "");
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

module.exports = {
  sliceObject,
  parseUrl,
  filterObject,
  appendObjectKeys,
  prependObjectKeys,
};
