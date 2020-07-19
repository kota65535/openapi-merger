"use strict";

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

module.exports = {
  sliceObject,
};
