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
   * Merge OpenAPI document into the single file.
   * @param doc {object} OpenAPI document object
   * @param inputFile {string} directory where the doc is located
   * @returns merged OpenAPI object
   */
  merge = async (doc, inputFile) => {
    let currentFile = Path.resolve(process.cwd(), inputFile);
    // convert to posix style path.
    // this path works with fs module like a charm on both windows and unix.
    currentFile = parseUrl(currentFile).path;

    // 1st merge: list all components
    this.manager = new ComponentManager();
    await this.mergeRefs(doc, currentFile, "$", new Set());

    // resolve component names in case of conflict
    const nameResolver = new ComponentNameResolver(this.manager.components);

    // 2nd merge: merge them all
    this.manager = new ComponentManager(nameResolver);
    doc = await this.mergeRefs(doc, currentFile, "$", new Set());
    doc.components = _.merge(doc.components, this.manager.getComponentsSection());
    return doc;
  };

  /**
   * Merges remote/URL references and inclusions in an object recursively.
   * @param obj a target object or array
   * @param file the name of the file containing the target object
   * @param jsonPath a JSON path for accessing the target object
   * @param done a set to hold file and JSON path arguments of previous calls
   * @returns {Promise<*[]|*>} a merged object or array
   */
  mergeRefs = async (obj, file, jsonPath, done) => {
    // prevent infinite loop
    const id = `${file}\0${jsonPath}`;
    if (done.has(id)) {
      return obj;
    }
    done.add(id);
    if (!_.isObject(obj)) {
      return obj;
    }
    let ret = _.isArray(obj) ? [] : {};
    for (const [key, val] of Object.entries(obj)) {
      if (this.shouldHandleRef(key, jsonPath)) {
        await this.handleRef(ret, key, val, file, jsonPath, done);
      } else if (this.shouldHandleInclude(key)) {
        ret = await this.handleInclude(ret, key, val, file, jsonPath, done);
      } else {
        // go recursively
        const merged = await this.mergeRefs(val, file, `${jsonPath}.${key}`, done);
        // merge arrays or objects according their type
        if (merged instanceof IncludedArray && _.isArray(ret)) {
          ret = mergeOrOverwrite(ret, merged);
        } else {
          ret[key] = mergeOrOverwrite(ret[key], merged);
        }
      }
    }
    return ret;
  };

  /**
   * Converts a remote/URL reference into local ones.
   * @param obj an object with a reference
   * @param key the key of the reference
   * @param val the value of the reference
   * @param file a name of the file containing the target object
   * @param jsonPath a JSON path for accessing the target object
   * @param done a done argument to be passed through to mergeRefs function
   */
  handleRef = async (obj, key, val, file, jsonPath, done) => {
    obj[key] = mergeOrOverwrite(obj[key], val);

    const pRef = parseUrl(val);
    const pFile = parseUrl(file);

    const refType = getRefType(jsonPath);
    if (shouldInclude(refType)) {
      await this.handleInclude(obj, key, val, file, jsonPath, done);
      return;
    }

    let cmp, nextFile, cmpExists;
    if (pRef.isHttp) {
      // URL ref
      cmpExists = this.manager.exists(pRef.href);
      cmp = await this.manager.getOrCreate(refType, pRef.href);
      nextFile = pRef.hrefWoHash;
    } else if (pRef.isLocal) {
      // local ref
      // avoid infinite loop
      if (this.manager.exists(val)) {
        return;
      }
      const href = pFile.hrefWoHash + (pRef.hash === "#/" ? "" : pRef.hash);
      cmpExists = this.manager.exists(href);
      cmp = await this.manager.getOrCreate(refType, href);
      nextFile = pFile.hrefWoHash;
    } else {
      // remote ref
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
    obj[key] = cmp.getLocalRef();
    // avoid infinite loop on recursive definition
    if (file === nextFile && cmpExists) {
      return;
    }
    const nextJsonPath = `$${pRef.hash ? pRef.hash.substr(1).replaceAll("/", ".") : ""}`;
    cmp.content = await this.mergeRefs(cmp.content, nextFile, nextJsonPath, done);
  };

  shouldHandleRef = (key, jsonPath) => {
    if (key === "$ref") {
      return true;
    }
    // discriminator mapping contains references
    if (jsonPath.endsWith(`discriminator.mapping`)) {
      return true;
    }
    return false;
  };

  /**
   * Convert an inclusion into its contents.
   * @param obj an object with an inclusion
   * @param key the key of the inclusion
   * @param val the value of the inclusion
   * @param file a name of the file containing the target object
   * @param jsonPath a JSON path for accessing the target object
   * @param done a done argument to be passed through to mergeRefs function
   * @returns {Promise<*>} a result object or array
   */
  handleInclude = async (obj, key, val, file, jsonPath, done) => {
    obj[key] = mergeOrOverwrite(obj[key], val);

    const pRef = parseUrl(val);
    const pFile = parseUrl(file);

    let content, nextFile;
    if (pRef.isHttp) {
      // URL ref
      content = await download(pRef.hrefWoHash);
      nextFile = pRef.hrefWoHash;
    } else if (pRef.isLocal) {
      // local ref
      // avoid infinite loop
      if (this.manager.get(val)) {
        return obj;
      }
      content = readYAML(file);
      nextFile = pFile.hrefWoHash;
    } else {
      // remote ref
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
            content[basename] = await this.handleInclude(
              { [key]: mf },
              key,
              mf,
              file,
              `${jsonPath}.${basename}`,
              done
            );
          }
        } else {
          // include a single file
          content = readYAML(parsedTarget.hrefWoHash);
        }
      }
      nextFile = parsedTarget.hrefWoHash;
    }
    const sliced = sliceObject(content, pRef.hash);
    const merged = await this.mergeRefs(sliced, nextFile, jsonPath, done);
    if (_.isArray(merged)) {
      if (_.isArray(obj)) {
        // merge array
        obj = obj.concat(merged);
      } else if (Object.keys(obj).length === 1) {
        // object having one and only $include key, turn into array.
        obj = IncludedArray.from(merged);
      } else {
        throw new Error(`cannot merge array content object. $include: ${val} at jsonPath=${jsonPath}`);
      }
    } else {
      // merge object
      const processed = processInclude(key, merged, this.config);
      _.merge(obj, processed);
      delete obj[key];
    }
    return obj;
  };

  shouldHandleInclude = (key) => {
    return key.match(Merger.INCLUDE_PATTERN);
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
