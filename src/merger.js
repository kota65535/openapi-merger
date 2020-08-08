"use strict";

const Path = require("path");
const Url = require("url");
const _ = require("lodash");
const { readYAML } = require("./yaml");
const { getRefType, shouldInclude } = require("./ref");
const { download } = require("./http");
const { sliceObject } = require("./util");
const { ComponentManager, ComponentNameResolver } = require("./components");

class Merger {
  constructor() {
    this.manager = new ComponentManager();
  }

  /**
   * merge OpenAPI document.
   * @param doc {object} OpenAPI object
   * @param inputDir {string} directory where the doc is located
   * @returns merged OpenAPI object
   */
  merge = async (doc, inputDir) => {
    const currentDir = Path.resolve(process.cwd(), inputDir);

    // 1st: list all components
    this.manager = new ComponentManager();
    await this.mergeRefs(doc.paths, currentDir, "$.paths");

    // resolve component names
    const nameResolver = new ComponentNameResolver(this.manager.components);

    // 2nd: merge them all
    this.manager = new ComponentManager(nameResolver);
    doc.paths = await this.mergeRefs(doc.paths, currentDir, "$.paths");
    doc.components = this.manager.getComponentsSection();
    return doc;
  };

  mergeRefs = async (obj, dir, jsonPath) => {
    if (!_.isObject(obj)) {
      return obj;
    }
    let ret = _.isArray(obj) ? [] : {};
    for (const [key, val] of Object.entries(obj)) {
      ret[key] = val;
      if (key === "$ref") {
        await this.handleRef(ret, key, val, dir, jsonPath);
      } else if (key.match(/^\$include(#.*)?/)) {
        await this.handleInclude(ret, key, val, dir, jsonPath);
      } else if (key === "discriminator") {
        await this.handleDiscriminator(ret, key, val, dir, jsonPath);
      } else {
        ret[key] = await this.mergeRefs(val, dir, `${jsonPath}.${key}`);
      }
    }
    return ret;
  };

  handleRef = async (ret, key, val, dir, jsonPath) => {
    const url = parseUrl(val);
    if (url.isLocal()) {
      return;
    }

    const refType = getRefType(jsonPath);
    if (shouldInclude(refType)) {
      await this.handleInclude(ret, key, val, dir, jsonPath);
      return;
    }

    let cmp, nextDir;
    if (url.isHttp()) {
      cmp = await this.manager.getOrCreate(refType, url.href);
      nextDir = Path.dirname(url.href);
    } else {
      // Remote Ref
      const dirUrl = parseUrl(dir);
      let href;
      if (dirUrl.isHttp()) {
        href = Url.resolve(dir + "/", val);
      } else {
        href = Path.join(dir, val);
      }
      cmp = await this.manager.getOrCreate(refType, href);
      nextDir = Path.dirname(href);
    }
    ret[key] = cmp.getLocalRef();
    cmp.content = await this.mergeRefs(cmp.content, nextDir, jsonPath);
  };

  handleInclude = async (ret, key, val, dir, jsonPath) => {
    const url = parseUrl(val);
    if (url.isLocal()) {
      return;
    }
    let content, nextDir;
    if (url.isHttp()) {
      content = await download(url.href);
      nextDir = Path.dirname(url.href);
    } else {
      // Remote Ref
      const filePath = Path.join(dir, val);
      content = readYAML(filePath);
      nextDir = Path.dirname(filePath);
    }
    const sliced = sliceObject(content, url.hash);
    const merged = await this.mergeRefs(sliced, nextDir, jsonPath);
    _.merge(ret, merged);
    delete ret[key];
  };

  handleDiscriminator = async (ret, key, val, dir, jsonPath) => {
    if (!val.mapping) {
      return;
    }
    for (const [mkey, mval] of Object.entries(val.mapping)) {
      await this.handleRef(
        val.mapping,
        mkey,
        mval,
        dir,
        `${jsonPath}.discriminator.${mkey}`
      );
    }
  };
}

function parseUrl(url) {
  let ret = Url.parse(url);
  ret.isLocal = () => !ret.path && ret.hash;
  ret.isHttp = () => ret.protocol && ret.protocol.match(/^(http|https):/);
  return ret;
}

module.exports = Merger;
