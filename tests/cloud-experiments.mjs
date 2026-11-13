import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Drive the real interaction controller through input events and animation frames.
class Element {
 constructor(){this.hidden=false;this.dataset={};this.listeners={};this.children=new Map();this.style={setProperty(){}};this.attrs={};this.value='50';}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 emit(k,e={}){for(const f of this.listeners[k]||[])f({preventDefault(){},...e});}
 querySelector(k){if(!this.children.has(k))this.children.set(k,new Element());return this.children.get(k);}
 querySelectorAll(){return [];}
 focus(){} setPointerCapture(){} showModal(){this.open=true;} close(){this.open=false;this.emit('close');}
}
const body=new Element(),nodes=[],doc=new Element();let blocked=false,raf,now=0;
doc.body=body;body.append=(...els)=>nodes.push(...els);doc.createElement=()=>new Element();doc.querySelector=()=>blocked?{}:null;
const context={document:doc,window:{Scene3D:{ok:true},SkyPreferences:{reduced:false}},performance:{now:()=>now},requestAnimationFrame:fn=>raf=fn,addEventListener(){},Math};
vm.runInNewContext(readFileSync(new URL('../cloud-experiments.js',import.meta.url),'utf8'),context);
const state=context.window.CloudExperiments,panel=nodes[0],hold=panel.querySelector('.feed-cloud'),auto=panel.querySelector('.auto-cloud');
function tick(n=1){for(let i=0;i<n;i++){now+=50;raf(now);}}
function view(id,visible=true){context.window.CloudExperimentView={id,visible};tick();}
view(0);assert.equal(panel.hidden,false);
hold.emit('pointerdown',{button:0,pointerId:1});tick(12);assert.ok(state.growth>.15&&state.growth<.3,'holding grows gradually');
hold.emit('pointerup');const paused=state.growth;tick(10);assert.equal(state.growth,paused,'releasing pauses the updraft');
auto.emit('click');tick(80);assert.equal(state.growth,1);assert.equal(state.strike,false,'cumulus never triggers lightning');
view(3);assert.equal(state.growth,0,'switching clouds resets the experiment');
auto.emit('click');tick(100);assert.equal(state.growth,1);assert.equal(state.strike,true,'the storm completion requests one strike');
state.strike=false;tick(30);assert.equal(state.strike,false,'completion does not request repeated strikes');
auto.emit('click');tick(5);assert.ok(state.growth>0&&state.growth<1,'try again starts a fresh build');
blocked=true;tick();const stopped=state.growth;tick(10);assert.equal(state.growth,stopped,'dialogs pause automatic growth');assert.equal(panel.hidden,true);
blocked=false;view(2);assert.equal(panel.hidden,true,'unrelated clouds have no prompt');
context.window.SkyPreferences.reduced=true;view(3);auto.emit('click');tick();assert.equal(state.growth,1,'reduced motion gets the final state directly');assert.equal(state.strike,false,'reduced motion never requests a flash');
view(5);assert.equal(hold.textContent,'Try the finger test');assert.equal(auto.hidden,true);
view(null,false);assert.equal(panel.hidden,true);assert.equal(state.growth,0);
console.log('PASS: holding/releasing, automatic growth, resets, modal pause, storm completion and reduced-motion protection.');
