import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
// The raymarched-noise checks were retired with the volumetric renderer (archived 12 Nov 2026).
const records=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('clouds.js',root),'utf8'),records);
const clouds=records.window.CLOUDS;assert.equal(new Set(clouds.map(c=>c.id)).size,10);
for(const cloud of clouds){assert.ok(cloud.look&&cloud.spot&&cloud.fact&&cloud.tip);assert.ok(['low','mid','high'].includes(cloud.tier));assert.ok(existsSync(new URL(cloud.image,root)),cloud.image);}
console.log('PASS: all ten cloud records and their photographs.');
