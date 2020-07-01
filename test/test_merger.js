'use strict'

const fs = require('fs-extra')
const glob = require('glob')
const merger = require('../src/merger')
const assert = require('chai').assert


describe('merger', () => {
    before(async () => {
        let promises = []
        for (const f of glob.sync('**/out.yaml')) {
            promises.push(fs.remove(f))
        }
        await Promise.all(promises)
    })

    it('petstore', async () => {
        // when
        await merger({
            input: 'resources/petstore/original.yaml',
            output: 'resources/petstore/out.yaml',
            debug: true
        })

        // then
        assert.equal(
            '' + fs.readFileSync('resources/petstore/out.yaml'),
            '' + fs.readFileSync('resources/petstore/expected.yaml'))
    });

    it('petstore_2', async () => {
        // when
        await merger({
            input: 'resources/petstore_2/original.yaml',
            output: 'resources/petstore_2/out.yaml',
            debug: true
        })

        // then
        assert.equal(
            '' + fs.readFileSync('resources/petstore_2/out.yaml'),
            '' + fs.readFileSync('resources/petstore_2/expected.yaml'))
    });
});

