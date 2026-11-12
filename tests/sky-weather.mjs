import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),context=vm.createContext({window:{}});
for(const file of ['clouds.js','sky-weather.js'])vm.runInContext(readFileSync(new URL(file,root),'utf8'),context);
const infer=context.window.SkyWeather.inferClouds;
assert.equal(infer({low:0,mid:0,high:0,code:0}).length,0,'clear weather must not introduce cloud cards');
const low=infer({low:72,mid:0,high:0,code:2,cape:0});
assert.deepEqual(Array.from(low,c=>c.id),[1],'only stratocumulus fits this low-cloud snapshot');
const layered=infer({low:45,mid:35,high:30,code:2,cape:200});
assert.deepEqual(Array.from(layered,c=>c.id).sort(),[0,5,7],'each populated altitude contributes its matching clouds');
const storm=infer({low:95,mid:80,high:90,code:95,cape:1200});
assert.ok(storm.some(c=>c.id===3&&c.level==='likely'));
assert.ok(storm.filter(c=>[5,6,7,8,9].includes(c.id)).every(c=>c.hidden),'low cloud must label the obscured upper layers');
for(const sample of [low,layered,storm]){
 assert.equal(new Set(sample.map(c=>c.id)).size,sample.length);
 assert.ok(sample.every(c=>context.window.CLOUDS.some(record=>record.id===c.id)));
}
console.log('PASS: clear skies, filtered single and multiple layers, storm estimates, hidden layers and valid unique cloud IDs.');

const rain=context.window.SkyWeather.rainForCode;
for(const code of [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99])assert.ok(rain(code)>0,`wet code ${code}`);
for(const code of [0,1,2,3,45,48,71,73,75,77,85,86])assert.equal(rain(code),0,`dry or snow code ${code}`);
assert.ok(rain(51)<rain(63)&&rain(63)<rain(65),'rain scales with reported intensity');
console.log('PASS: rain, drizzle, showers and storms enable rain; dry weather and snow do not.');
