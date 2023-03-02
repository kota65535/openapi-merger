"use strict";

const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const main = require("../src/main");
const log = require("loglevel");
const assert = require("chai").assert;

log.setLevel("debug");

const runMerger = async (name) => {
  const configFile = path.join("resources", name, "config.yaml");
  const params = {
    input: path.join("resources", name, "openapi.yaml"),
    output: path.join("resources", name, "out.yaml"),
    config: fs.existsSync(configFile) ? configFile : null,
    debug: true,
  };
  await main(params);
  // ignore carriage return for cross-platform
  assert.equal(
    ("" + fs.readFileSync(params.output)).replace(/\r/g, ""),
    ("" + fs.readFileSync(path.join("resources", name, "expected.yaml"))).replace(/\r/g, "")
  );
};

describe("merger", () => {
  before(async () => {
    const promises = [];
    for (const f of glob.sync("**/out.yaml")) {
      promises.push(fs.remove(f));
    }
    await Promise.all(promises);
  });

  it("basic test", async () => {
    await runMerger("petstore");
  });

  it("hash", async () => {
    await runMerger("petstore_1");
  });

  it("paths dir", async () => {
    await runMerger("petstore_2");
  });

  it("discriminator", async () => {
    await runMerger("petstore_3");
  });

  it("discriminator & hash", async () => {
    await runMerger("petstore_4");
  });

  it("schema name conflict", async () => {
    await runMerger("petstore_5");
  });

  it("with $include", async () => {
    await runMerger("petstore_6");
  });

  it("http ref", async () => {
    await runMerger("petstore_7");
  });

  it("http ref & hash", async () => {
    await runMerger("petstore_8");
  });

  it("$include http ref", async () => {
    await runMerger("petstore_9");
  });

  it("$include with key pattern", async () => {
    await runMerger("petstore_10");
  });

  it("$include anywhere", async () => {
    await runMerger("petstore_11");
  });

  it("$include with glob", async () => {
    await runMerger("petstore_12");
  });

  it("recursive", async () => {
    await runMerger("petstore_13");
  });

  it("ref type inference", async () => {
    await runMerger("petstore_14");
  });

  it("discriminator with local ref", async () => {
    await runMerger("petstore_15");
  });
});
