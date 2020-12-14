"use strict";

const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const main = require("../src/main");
const assert = require("chai").assert;

const runMerger = async (name) => {
  const params = {
    input: path.join("resources", name, "openapi.yaml"),
    output: path.join("resources", name, "out.yaml"),
    debug: true,
  };
  await main(params);
  assert.equal(
    "" + fs.readFileSync(params.output),
    "" + fs.readFileSync(path.join("resources", name, "expected.yaml"))
  );
};

describe("merger", () => {
  before(async () => {
    let promises = [];
    for (const f of glob.sync("**/out.yaml")) {
      promises.push(fs.remove(f));
    }
    await Promise.all(promises);
  });

  it("basic test", async () => {
    await runMerger("petstore");
  });

  it("with hash", async () => {
    await runMerger("petstore_1");
  });

  it("with paths dir", async () => {
    await runMerger("petstore_2");
  });

  it("with discriminator", async () => {
    await runMerger("petstore_3");
  });

  it("with discriminator & hash", async () => {
    await runMerger("petstore_4");
  });

  it("with schema name conflict", async () => {
    await runMerger("petstore_5");
  });

  it("with $include", async () => {
    await runMerger("petstore_6");
  });

  it("with http ref", async () => {
    await runMerger("petstore_7");
  });

  it("with http ref & hash", async () => {
    await runMerger("petstore_8");
  });

  it("with $include http ref", async () => {
    await runMerger("petstore_9");
  });

  it("with $include with key pattern", async () => {
    await runMerger("petstore_10");
  });
});
