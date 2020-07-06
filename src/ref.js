"use strict";

const _ = require("lodash");

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

module.exports = {
  searchRef,
};
