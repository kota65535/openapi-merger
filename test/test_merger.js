"use strict";

const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const merger = require("../src/merger");
const assert = require("chai").assert;

const runMerger = async (name) => {
  const params = {
    input: path.join("resources", name, "openapi.yaml"),
    output: path.join("resources", name, "out.yaml"),
    debug: true,
  };
  await merger(params);
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

  it("with paths dir", async () => {
    await runMerger("petstore_2");
  });

  it("with discriminator", async () => {
    await runMerger("petstore_3");
  });

  it("schema name conflict", async () => {
    await runMerger("petstore_4");
  });
  it("http ref", async () => {
    await runMerger("petstore_5");
  });
});
