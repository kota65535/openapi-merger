"use strict";

const Path = require("path");
const Url = require("url");
const Glob = require("glob");
const _ = require("lodash");
const { readYAML } = require("./yaml");
const { getRefType, shouldInclude } = require("./ref");
const { download } = require("./http");
const {
  sliceObject,
  parseUrl,
  filterObject,
  appendObjectKeys,
  prependObjectKeys,
  mergeOrOverwrite,
  IncludedArray,
} = require("./util");
const { ComponentManager, ComponentNameResolver } = require("./components");

class Merger {
  static INCLUDE_PATTERN = /^\$include(#\w+?)?(\.\w+?)?$/;

  constructor(config) {
    this.manager = new ComponentManager();
    this.config = config;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * merge OpenAPI document.
   * @param doc {object} OpenAPI object
   * @param inputFile {string} directory where the doc is located
   * @returns merged OpenAPI object
   */
  merge = async (doc, inputFile) => {
    let currentFile = Path.resolve(process.cwd(), inputFile);
    // convert to posix style path.
    // this path works with fs module like a charm  on both windows and unix.
    currentFile = parseUrl(currentFile).path;

    // 1st merge: list all components
    this.manager = new ComponentManager();
    await this.mergeRefs(doc, currentFile, "$");

    // resolve component names in case of conflict
    const nameResolver = new ComponentNameResolver(this.manager.components);

    // 2nd merge: merge them all
    this.manager = new ComponentManager(nameResolver);
    doc = await this.mergeRefs(doc, currentFile, "$");
    doc.components = _.merge(doc.components, this.manager.getComponentsSection());
    return doc;
  };

  mergeRefs = async (obj, file, jsonPath) => {
    if (!_.isObject(obj)) {
      return obj;
    }
    let ret = _.isArray(obj) ? [] : {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "$ref") {
        await this.handleRef(ret, key, val, file, jsonPath);
      } else if (key.match(Merger.INCLUDE_PATTERN)) {
        ret = await this.handleInclude(ret, key, val, file, jsonPath);
      } else if (key === "discriminator") {
        await this.handleDiscriminator(ret, key, val, file, jsonPath);
      } else {
        const merged = await this.mergeRefs(val, file, `${jsonPath}.${key}`);
        if (merged instanceof IncludedArray && _.isArray(ret)) {
          ret = mergeOrOverwrite(ret, merged);
        } else {
          ret[key] = mergeOrOverwrite(ret[key], merged);
        }
      }
    }
    return ret;
  };

  handleRef = async (ret, key, val, file, jsonPath) => {
    ret[key] = mergeOrOverwrite(ret[key], val);

    const pRef = parseUrl(val);
    const pFile = parseUrl(file);

    const refType = getRefType(jsonPath);
    if (shouldInclude(refType)) {
      await this.handleInclude(ret, key, val, file, jsonPath);
      return;
    }

    let cmp, nextFile, cmpExists;
    if (pRef.isHttp) {
      cmpExists = this.manager.exists(pRef.href);
      cmp = await this.manager.getOrCreate(refType, pRef.href);
      nextFile = pRef.hrefWoHash;
    } else if (pRef.isLocal) {
      // avoid infinite loop
      if (this.manager.exists(val)) {
        return;
      }
      const href = pFile.hrefWoHash + (pRef.hash === "#/" ? "" : pRef.hash);
      cmpExists = this.manager.exists(href);
      cmp = await this.manager.getOrCreate(refType, href);
      nextFile = pFile.hrefWoHash;
    } else {
      let target;
      if (pFile.isHttp) {
        target = Url.resolve(Path.dirname(pFile.hrefWoHash) + "/", val);
      } else {
        target = Path.posix.join(Path.posix.dirname(pFile.hrefWoHash), val);
      }
      const parsedTarget = parseUrl(target);
      cmpExists = this.manager.exists(target);
      cmp = await this.manager.getOrCreate(refType, target);
      nextFile = parsedTarget.hrefWoHash;
    }
    ret[key] = cmp.getLocalRef();
    // avoid infinite loop on recursive definition
    if (file === nextFile && cmpExists) {
      return;
    }
    cmp.content = await this.mergeRefs(cmp.content, nextFile, jsonPath);
  };

  handleInclude = async (ret, key, val, file, jsonPath) => {
    ret[key] = mergeOrOverwrite(ret[key], val);

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
        target = Path.posix.join(Path.posix.dirname(pFile.hrefWoHash), val);
      }
      const parsedTarget = parseUrl(target);
      if (parsedTarget.isHttp) {
        content = await download(parsedTarget.hrefWoHash);
      } else {
        // handle glob pattern
        content = {};
        if (parsedTarget.hrefWoHash.includes("*")) {
          const matchedFiles = Glob.sync(parsedTarget.hrefWoHash).map((p) =>
            Path.relative(Path.dirname(pFile.hrefWoHash), p)
          );
          // include multiple files
          for (const mf of matchedFiles) {
            const basename = Path.basename(mf, Path.extname(mf));
            content[basename] = await this.handleInclude({ [key]: mf }, key, mf, file, `${jsonPath}.${basename}`);
          }
        } else {
          // include a single file
          content = readYAML(parsedTarget.hrefWoHash);
        }
      }
      nextFile = parsedTarget.hrefWoHash;
    }
    const sliced = sliceObject(content, pRef.hash);
    const merged = await this.mergeRefs(sliced, nextFile, jsonPath);
    if (_.isArray(merged)) {
      if (_.isArray(ret)) {
        // merge array
        ret = ret.concat(merged);
      } else if (Object.keys(ret).length === 1) {
        // object having one and only $include key, turn into array.
        ret = IncludedArray.from(merged);
      } else {
        throw new Error(`cannot merge array content object. $include: ${val} at jsonPath=${jsonPath}`);
      }
    } else {
      // merge object
      const processed = processInclude(key, merged, this.config);
      _.merge(ret, processed);
      delete ret[key];
    }
    return ret;
  };

  handleDiscriminator = async (ret, key, val, file, jsonPath) => {
    ret[key] = mergeOrOverwrite(ret[key], val);

    if (!val.mapping) {
      return;
    }
    for (const [mkey, mval] of Object.entries(val.mapping)) {
      const parsedRef = parseUrl(mval);
      if (parsedRef.isLocal && this.manager.get(mval)) {
        continue;
      }
      if (mval) await this.handleRef(val.mapping, mkey, mval, file, `${jsonPath}.discriminator.${mkey}`);
    }
  };
}

function processInclude(key, obj, config) {
  const clazz = getIncludeClass(key);
  if (!clazz) {
    return obj;
  }
  const clazzConfig = config.include[clazz];
  if (!clazzConfig) {
    console.warn(`$include classname '${clazz} specified, but no configuration found.`);
    return obj;
  }
  obj = filterObject(obj, clazzConfig.filter);
  obj = appendObjectKeys(obj, clazzConfig.prefix);
  obj = prependObjectKeys(obj, clazzConfig.suffix);
  return obj;
}

function getIncludeClass(key) {
  const groups = key.match(Merger.INCLUDE_PATTERN);
  const pattern = groups ? groups[2] : null;
  return pattern ? pattern.substr(1) : null;
}

module.exports = Merger;
