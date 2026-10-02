import test from 'node:test'; import assert from 'node:assert/strict'; import {add} from './canary.mjs'; test('bounded canary',()=>assert.equal(add(2,3),5));
