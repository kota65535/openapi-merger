/**
 * Created by WindomZ on 18-2-26.
 */
'use strict'

/**
 * Split the reference definition to file path and hashtag path.
 * start with '$ref' or '$ref#'.
 *
 * @param {string} ref
 * @return {object}
 * @api private
 */
const url = require('url')

function parseRef (ref) {
  const u = url.parse(ref)
  const protocol = u.protocol
  const filePath = (protocol ? protocol + '//' : '') + (u.host || '') + (u.path || '')
  let hashtag = null
  if (u.hash) {
    const mo = u.hash.match(/#\/?(.+)/)
    if (mo) {
      hashtag = mo[1]
    }
  }
  return { protocol, filePath, hashtag }
}

/**
 * Slice hashtag path from JSON content.
 *
 * @param {object} obj
 * @param {string} hashtag
 * @return {string}
 * @api private
 */
function sliceHashtagJSON (obj, hashtag) {
  if (hashtag) {
    hashtag.split('/').every(k => {
      obj = Object.getOwnPropertyDescriptor(obj, k).value
      return obj
    })
  }
  return obj
}

module.exports.sliceHashtag = sliceHashtagJSON
module.exports.parseRef = parseRef
