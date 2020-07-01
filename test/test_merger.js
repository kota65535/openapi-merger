'use strict'

const fs = require('fs')
const merger = require('../src/merger')
const assert = require('chai').assert

describe('merger', () => {
    it('petstore', async () => {
        // given
        process.chdir('test')

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
});

