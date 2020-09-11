"use strict";

const Path = require("path");
const Url = require("url");
const _ = require("lodash");
const { readYAML } = require("./yaml");
const { getRefType, shouldInclude } = require("./ref");
const { download } = require("./http");
const { sliceObject, parseUrl } = require("./util");
const { ComponentManager, ComponentNameResolver } = require("./components");

class Merger {
  constructor() {
    this.manager = new ComponentManager();
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * merge OpenAPI document.
   * @param doc {object} OpenAPI object
   * @param inputFile {string} directory where the doc is located
   * @returns merged OpenAPI object
   */
  merge = async (doc, inputFile) => {
    const currentFile = Path.resolve(process.cwd(), inputFile);

    // 1st merge: list all components
    this.manager = new ComponentManager();
    await this.mergeRefs(doc.paths, currentFile, "$.paths");

    // resolve component names in case of conflict
    const nameResolver = new ComponentNameResolver(this.manager.components);

    // 2nd merge: merge them all
    this.manager = new ComponentManager(nameResolver);
    doc.paths = await this.mergeRefs(doc.paths, currentFile, "$.paths");
    doc.components = _.merge(
      doc.components,
      this.manager.getComponentsSection()
    );
    return doc;
  };

  mergeRefs = async (obj, file, jsonPath) => {
    if (!_.isObject(obj)) {
      return obj;
    }
    let ret = _.isArray(obj) ? [] : {};
    for (const [key, val] of Object.entries(obj)) {
      ret[key] = val;
      if (key === "$ref") {
        await this.handleRef(ret, key, val, file, jsonPath);
      } else if (key.match(/^\$include(#.*)?/)) {
        ret = await this.handleInclude(ret, key, val, file, jsonPath);
      } else if (key === "discriminator") {
        await this.handleDiscriminator(ret, key, val, file, jsonPath);
      } else {
        const merged = await this.mergeRefs(val, file, `${jsonPath}.${key}`);
        if (_.isArray(ret) && _.isArray(merged)) {
          // merge array
          ret.splice(Number(key), 1);
          ret = ret.concat(merged);
        } else {
          ret[key] = merged;
        }
      }
    }
    return ret;
  };

  handleRef = async (ret, key, val, file, jsonPath) => {
    const pRef = parseUrl(val);
    const pFile = parseUrl(file);

    const refType = getRefType(jsonPath);
    if (shouldInclude(refType)) {
      await this.handleInclude(ret, key, val, file, jsonPath);
      return;
    }

    let cmp, nextFile;
    if (pRef.isHttp) {
      cmp = await this.manager.getOrCreate(refType, pRef.href);
      nextFile = pRef.hrefWoHash;
    } else if (pRef.isLocal) {
      // avoid infinite loop
      if (this.manager.get(val)) {
        return;
      }
      const href = pFile.hrefWoHash + pRef.hash;
      cmp = await this.manager.getOrCreate(refType, href);
      nextFile = pFile.hrefWoHash;
    } else {
      let target;
      if (pFile.isHttp) {
        target = Url.resolve(Path.dirname(pFile.hrefWoHash) + "/", val);
      } else {
        target = Path.join(Path.dirname(pFile.hrefWoHash), val);
      }
      const parsedTarget = parseUrl(target);
      cmp = await this.manager.getOrCreate(refType, target);
      nextFile = parsedTarget.hrefWoHash;
    }
    ret[key] = cmp.getLocalRef();
    cmp.content = await this.mergeRefs(cmp.content, nextFile, jsonPath);
  };

  handleInclude = async (ret, key, val, file, jsonPath) => {
    const pRef = parseUrl(val);
    const pFile = parseUrl(file);

    let content, nextFile;
    if (pRef.isHttp) {
      content = await download(pRef.hrefWoHash);
      nextFile = pRef.hrefWoHash;
    } else if (pRef.isLocal) {
      // avoid infinite loop
      if (this.manager.get(val)) {
        return ret;
      }
      content = readYAML(file);
      nextFile = pFile.hrefWoHash;
    } else {
      let target;
      if (pFile.isHttp) {
        target = Url.resolve(Path.dirname(pFile.hrefWoHash) + "/", val);
      } else {
        target = Path.join(Path.dirname(pFile.hrefWoHash), val);
      }
      const parsedTarget = parseUrl(target);
      if (parsedTarget.isHttp) {
        content = await download(parsedTarget.hrefWoHash);
      } else {
        content = readYAML(parsedTarget.hrefWoHash);
      }
      nextFile = parsedTarget.hrefWoHash;
    }
    const sliced = sliceObject(content, pRef.hash);
    const merged = await this.mergeRefs(sliced, nextFile, jsonPath);
    if (_.isArray(merged)) {
      // merge array
      if (Object.keys(ret).length === 1) {
        ret = merged;
      } else {
        throw new Error(
          `cannot merge array content object. $include: ${val} at jsonPath=${jsonPath}`
        );
      }
    } else {
      // merge object
      _.merge(ret, merged);
      delete ret[key];
    }
    return ret;
  };

  handleDiscriminator = async (ret, key, val, file, jsonPath) => {
    if (!val.mapping) {
      return;
    }
    for (const [mkey, mval] of Object.entries(val.mapping)) {
      const parsedRef = parseUrl(mval);
      if (parsedRef.isLocal && this.manager.get(mval)) {
        continue;
      }
      if (mval)
        await this.handleRef(
          val.mapping,
          mkey,
          mval,
          file,
          `${jsonPath}.discriminator.${mkey}`
        );
    }
  };
}

module.exports = Merger;
