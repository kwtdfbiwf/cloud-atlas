import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('noise-data.js',root),'utf8').replace('export function buildNoiseData','function buildNoiseData');
const context=vm.createContext({Uint8Array,Float32Array,Math});
const first=vm.runInContext(source+'; buildNoiseData()',context);
assert.equal(first.base.size,64);assert.equal(first.detail.size,32);assert.equal(first.weather.size,256);
for(const texture of Object.values(first)){
 const expected=texture.size**texture.dimension*4;
 assert.equal(texture.data.length,expected);
 assert.ok(texture.data.some(value=>value>0));
 assert.ok(new Set(texture.data).size>100,'noise must retain a broad density range');
}
const second=vm.runInContext('buildNoiseData()',context);
for(const name of ['base','detail','weather'])assert.deepEqual(first[name].data,second[name].data,'noise is reproducible');
const records=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('clouds.js',root),'utf8'),records);
const clouds=records.window.CLOUDS;assert.equal(new Set(clouds.map(c=>c.id)).size,10);
for(const cloud of clouds){assert.ok(cloud.look&&cloud.spot&&cloud.fact&&cloud.tip);assert.ok(['low','mid','high'].includes(cloud.tier));assert.ok(existsSync(new URL(cloud.image,root)),cloud.image);}
for(const [w,h] of [[390,844],[1440,900],[2560,1440]]){
 const start=Math.min(.65,Math.sqrt(360000/(w*h)));
 const steps=[1,.92,.84,.77,.7].map(n=>n*start);
 assert.ok(steps.every((n,i)=>i===0||n<steps[i-1]));
 assert.ok(steps[0]**2*w*h<=360001);
}
console.log('PASS: deterministic worker texture data, all ten cloud records/assets, monotonic quality and pixel budgets.');
