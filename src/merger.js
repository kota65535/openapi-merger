"use strict";

const path = require("path");
const yaml = require("./yaml");
const fs = require("fs-extra");
const mktemp = require("mktemp");
const { createComponents } = require("./components");
const mergeRefs = require("./merge_refs");

async function merger(params) {
  let input, inputDir;
  try {
    input = await prepare(params.input);
    inputDir = path.dirname(input);
    let doc = await yaml.readYAML(input);

    const components = await createComponents(inputDir);
    doc = mergeRefs(doc, inputDir, components);

    console.info("Writing: " + params.output);
    yaml.writeYAML(doc, params.output);
  } catch (e) {
    // show error message
    if (params.debug) {
      console.error(e);
    } else {
      console.error("Error :" + e.message);
    }
  } finally {
    // remove temporary directory
    await fs.remove(inputDir);
    console.debug("removed temporary directory.");
  }
}

/**
 * Create temporary working directory.
 * @param inputFile {string}
 * @returns {Promise<*>}
 */
async function prepare(inputFile) {
  const inputDir = path.dirname(inputFile);
  const tmpDir = await mktemp.createDir(path.join(inputDir, "XXXXX.tmp"));

  console.debug(`temporary directory: ${tmpDir}`);

  const targets = [
    { input: inputFile, output: path.join(tmpDir, path.basename(inputFile)) },
    {
      input: path.join(inputDir, "components"),
      output: path.join(tmpDir, "components"),
    },
    { input: path.join(inputDir, "paths"), output: path.join(tmpDir, "paths") },
  ];

  let promises = [];
  for (const target of targets) {
    try {
      fs.accessSync(target.input);
      promises.push(fs.copy(target.input, target.output));
    } catch (e) {
      console.info(`failed to access: ${target.input}`);
    }
  }

  await Promise.all(promises);

  return path.join(tmpDir, path.basename(inputFile));
}

module.exports = merger;
