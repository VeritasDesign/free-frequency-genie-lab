import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUpstreamUrl} from './lib/nws-transport.js';
import {representativePoint} from './src/geo.js';
test('point route stays on api.weather.gov',()=>assert.equal(buildUpstreamUrl('/api/nws?op=point&lat=43.62&lon=-84.25').href,'https://api.weather.gov/points/43.62,-84.25'));
test('forecast route stays on api.weather.gov',()=>assert.equal(buildUpstreamUrl('/api/nws?op=forecast&office=DTX&x=65&y=90').href,'https://api.weather.gov/gridpoints/DTX/65,90/forecast'));
test('point rejects unknown parameter',()=>assert.throws(()=>buildUpstreamUrl('/api/nws?op=point&lat=43&lon=-84&url=https://evil.test')));
test('representative point derives from official geometry',()=>assert.deepEqual(representativePoint({type:'Polygon',coordinates:[[[-85,43],[-84,43],[-84,44],[-85,44],[-85,43]]]}),{lon:-84.5,lat:43.5,method:'official-zone-bounds-midpoint'}));
