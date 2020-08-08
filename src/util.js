"use strict";

const Url = require("url");

function sliceObject(obj, hash) {
  if (!hash || !hash.startsWith("#")) {
    return obj;
  }
  hash = hash.substr(2);
  hash.split("/").every((k) => {
    obj = Object.getOwnPropertyDescriptor(obj, k).value;
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

module.exports = {
  sliceObject,
  parseUrl,
};
