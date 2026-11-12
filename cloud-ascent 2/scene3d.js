import {createWindowRain} from './window-rain.js?v=location-rain-2';
import * as THREE from 'three';
import {createLiveGlassRain} from './live-glass-rain.js?v=3';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
const S=window.Scene3D={ok:false,unavailable:false,rainBox:()=>null};
const canvas=document.querySelector('#sky3d');
const vectorSky=document.querySelector('#vector-sky');
const sunElement=document.querySelector('#day-sun'), moonElement=document.querySelector('#night-moon'), starElement=document.querySelector('#night-stars'), solarHalo=document.querySelector('#day-sun-halo');
const labels=['Cu','Sc','St','Cb','Ns','Ac','As','Ci','Cs','Cc'];
const levels=[1200,1600,550,1550,4300,4200,5200,9500,9700,8300];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=seed=>{let n=seed;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};};
try{
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'default',alpha:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
const glassRain=createLiveGlassRain(renderer);
const windowRain=createWindowRain();
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,500);
camera.position.set(0,0,34);camera.lookAt(0,1,0);
scene.add(new THREE.HemisphereLight('#dfafff','#333b9b',2));
const warm=new THREE.DirectionalLight('#ffd5ab',4.2);warm.position.set(14,10,6);scene.add(warm);
const fill=new THREE.DirectionalLight('#d183ff',1.8);fill.position.set(-12,1,-4);scene.add(fill);
const rim=new THREE.DirectionalLight('#ffb4be',2.8);rim.position.set(4,9,-9);scene.add(rim);
const bg=document.createElement('canvas');bg.width=512;bg.height=768;const bctx=bg.getContext('2d'),texture=new THREE.CanvasTexture(bg);texture.colorSpace=THREE.SRGBColorSpace;scene.background=texture;
let stormBlend=0;
let bgKey=-1, nightBlend=document.body.classList.contains('night-sky')?1:0;
const cloudMaterials=[];
let phaseTarget=nightBlend, phaseStart=nightBlend, phaseElapsed=4, phaseDuration=3.2;
const softStep=(a,b,x)=>{const p=clamp((x-a)/(b-a),0,1);return p*p*(3-2*p);};
function celestialMotion(reduced,id){
 const sunSet=softStep(0,.72,nightBlend),moonRise=softStep(.38,1,nightBlend);
 sunElement.style.opacity=((1-softStep(.22,.72,nightBlend))*(1-stormBlend*.98)).toFixed(3);
 sunElement.style.transform=`translateY(${reduced?0:(sunSet*90).toFixed(3)}vh)`;
 moonElement.style.opacity=(softStep(.38,.85,nightBlend)*(1-stormBlend*.85)).toFixed(3);
 moonElement.style.transform=`translateY(${reduced?0:((1-moonRise)*86).toFixed(3)}vh)`;
 starElement.style.opacity=(softStep(.4,.98,nightBlend)*(1-stormBlend*.96)).toFixed(3);
 solarHalo.style.opacity=id===8?'1':'0';
 const canDrag=nightBlend<.08&&stormBlend<.8;
 const dragTarget=document.querySelector('#sun-drag-target');
 if(dragTarget){
   dragTarget.style.pointerEvents=canDrag?'auto':'none';dragTarget.tabIndex=canDrag?0:-1;
   dragTarget.setAttribute('aria-hidden',String(!canDrag));
   dragTarget.style.transform=sunElement.style.transform;
 }
 vectorSky.dataset.transition=nightBlend===phaseTarget?'settled':phaseTarget?'nightfall':'daybreak';
 vectorSky.dataset.phase=nightBlend.toFixed(3);
}

function skyColour(day,night){
 const brightness=new THREE.Color(day).getHSL({h:0,s:0,l:0}).l;const middle=brightness>=.48&&brightness<.72,lower=brightness>=.72;
 const dusk=middle?'#ad7d9f':lower?'#e6a180':'#70538c';
 const colour=new THREE.Color(day).lerp(new THREE.Color(night),nightBlend).lerp(new THREE.Color(dusk),Math.sin(nightBlend*Math.PI)*.42);
 const overcast=new THREE.Color(middle?'#586b85':lower?'#8493a9':'#40516b').lerp(new THREE.Color(middle?'#1c2b42':lower?'#34445d':'#111b2c'),nightBlend);
 return colour.lerp(overcast,stormBlend*.94).getStyle();
}
const themeColour=document.querySelector('meta[name="theme-color"]');
// The colour changes continuously with altitude: warm open air, cooler middle, deep ice-blue.
function altitudePalette(alt){
 const stops=[{at:0,top:'#688fe8',middle:'#82a8ed',bottom:'#b2caf2'},{at:4500,top:'#536ed4',middle:'#718fe3',bottom:'#a0b9ec'},{at:9000,top:'#384fa9',middle:'#5b77cb',bottom:'#8fa8e2'},{at:12500,top:'#2b3c88',middle:'#4d64b5',bottom:'#91abe4'}];
 let i=1;while(i<stops.length-1&&alt>stops[i].at)i++;
 const a=stops[i-1],b=stops[i],f=softStep(a.at,b.at,alt);
 return Object.fromEntries(['top','middle','bottom'].map(key=>[key,new THREE.Color(a[key]).lerp(new THREE.Color(b[key]),f).getStyle()]));
}
function background(alt,updateSky=false){const key=Math.round(alt/150)+':'+Math.round(nightBlend*60)+':'+Math.round(stormBlend*60);if(key===bgKey)return;bgKey=key;
 const palette=altitudePalette(alt),top=skyColour(palette.top,'#101635'),middle=skyColour(palette.middle,'#1c2854'),bottom=skyColour(palette.bottom,'#3c4c79');
 const g=bctx.createLinearGradient(0,0,512,768);g.addColorStop(0,top);g.addColorStop(.48,middle);g.addColorStop(1,bottom);bctx.fillStyle=g;bctx.fillRect(0,0,512,768);
 const glow=bctx.createRadialGradient(500,0,4,500,0,490);glow.addColorStop(0,'#c8b6ee30');glow.addColorStop(1,'#c8b6ee00');bctx.fillStyle=glow;bctx.fillRect(0,0,512,768);
 if(updateSky){
   vectorSky.style.background=`radial-gradient(ellipse at 100% 0%,#cfbdf122,transparent 65%),linear-gradient(160deg,${top} 0%,${middle} 48%,${bottom} 100%)`;
   vectorSky.style.setProperty('--night-opacity',nightBlend.toFixed(3));
   document.documentElement.style.background=vectorSky.style.background;document.documentElement.style.backgroundColor=middle;themeColour?.setAttribute('content',middle);
 }
 texture.needsUpdate=true;
}
background(0,true);
const draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
const gltf=await new GLTFLoader().setDRACOLoader(draco).loadAsync('reference-clouds/reference-clouds.glb?v=draco-1');
draco.dispose();
// Soft opalescent colour is painted by surface direction, not expensive lights.
// The minimum shade stays lavender-blue, so undersides never fall into black.
function opalMaterial(){return new THREE.ShaderMaterial({
 vertexColors:true,
 uniforms:{uLightning:{value:0},uOpacity:{value:1},uStorm:{value:0},uGloom:{value:0},uSunDir:{value:new THREE.Vector3(.51,.76,1.2)},uSunLow:{value:0},uNight:{value:nightBlend},uKind:{value:0},uTime:{value:0},uMotion:{value:1}},
 vertexShader:`uniform float uTime;uniform float uKind;uniform float uMotion;
 varying vec3 vN;varying vec3 vP;varying vec3 vPaint;
 void main(){
   vN=normalize(normalMatrix*normal);vP=position;vPaint=color.rgb;
   vec3 p=position;
   if(uMotion>.5){
     if(uKind<.5){
       // Cumulus breathes slowly, with fuller sunlit billows.
       p+=normal*(.075+.025*max(normal.y,0.))*sin(uTime*.38+position.y*.35+position.x*.25);
     }else if(abs(uKind-7.)<.5){
       // High ice fibres lengthen gently along the wind, without vertical bobbing.
       p.x+=.16*sin(uTime*.22+position.y*.3)*smoothstep(-3.,3.,position.x);
     }else if(abs(uKind-3.)<.5){
       // The tower builds almost imperceptibly while its base stays steady.
       p.y+=.10*sin(uTime*.24)*smoothstep(-3.,4.,position.y);
       p+=normal*.035*sin(uTime*.31+position.y*.45);
     }else if(abs(uKind-2.)<.5||abs(uKind-4.)<.5||abs(uKind-6.)<.5||abs(uKind-8.)<.5){
       // Layer clouds carry a broad, shallow travelling ripple.
       p.y+=.045*sin(position.x*.24-uTime*.24);
     }else{
       // Patch clouds soften and swell in an unhurried wave across the band.
       p+=normal*.045*sin(uTime*.3+position.x*.35+position.z*.22);
     }
   }
   gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
 }`,
 fragmentShader:`uniform float uKind;uniform float uLightning;uniform float uOpacity;uniform float uStorm;uniform float uGloom;uniform float uNight;uniform vec3 uSunDir;uniform float uSunLow;varying vec3 vN;varying vec3 vP;varying vec3 vPaint;
 void main(){
 vec3 n=normalize(vN);
 // Soft colour and local billow shadowing were painted offline in Blender.
 vec3 col=vPaint*(.94+.06*max(0.,n.z));
 // High ice clouds read as cool, pale filaments; low heaps keep their warmer pastel billows.
 if(uKind>6.5)col=mix(col,vec3(.83,.9,1.),.48);
 else if(uKind>4.5)col=mix(col,vec3(.86,.86,.98),.18);
 // Re-light the painted billows relative to their original light, preserving their colours.
 float daylight=1.-uNight;
 float facing=dot(n,normalize(uSunDir));
 float originalFacing=dot(n,normalize(vec3(.51,.76,1.2)));
 float shade=clamp(1.+(facing-originalFacing)*.55,.65,1.25);
 col*=mix(1.,shade,daylight);
 col*=mix(vec3(1.),vec3(1.07,.9,.78),uSunLow*daylight*(1.-uGloom));
 col=mix(col,col*vec3(.82,.84,.97),uStorm*.35);
 float grey=dot(col,vec3(.2126,.7152,.0722));
 col=mix(col,vec3(grey)*vec3(.58,.66,.82),uGloom*.68);
 vec3 moonlit=col*vec3(.35,.48,.79)+vec3(.018,.026,.065);
 col=mix(col,moonlit,uNight);
 // A local lavender illumination within the storm, rather than a screen flash.
 float glow=exp(-dot(vP.xy-vec2(1.,-2.),vP.xy-vec2(1.,-2.))*.018);
 col=mix(col,vec3(.88,.79,1.),uLightning*glow*.72);
 gl_FragColor=vec4(col,uOpacity);
 #include <colorspace_fragment>
 }`});}
const prototypes={};gltf.scene.traverse(o=>{if(o.isMesh){
 if(o.name==='Cb'){
  const geo=o.geometry.clone();geo.computeBoundingBox();const box=geo.boundingBox,pos=geo.attributes.position,cx=(box.min.x+box.max.x)/2,height=box.max.y-box.min.y;
  for(let i=0;i<pos.count;i++){
   const y=pos.getY(i),t=(y-box.min.y)/height,anvil=softStep(.7,.95,t);
   pos.setX(i,cx+(pos.getX(i)-cx)*(1+anvil*.42));
   if(t>.84)pos.setY(i,box.min.y+height*(.84+(t-.84)*.48));
  }
  geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();o.geometry=geo;
 }
 prototypes[o.name]=o;o.material=opalMaterial();
}});
const layers=[];
for(let id=0;id<10;id++){
 const group=new THREE.Group();scene.add(group);const r=rand(71+id*311);
 const count=id===3?1:[2,4,6,8].includes(id)?2:[1,5,9].includes(id)?3:id===7?3:6;
 for(let i=0;i<count;i++){
   const proto=prototypes[id===0?'Cu_'+i%3:labels[id]];if(!proto)throw new Error('Missing '+labels[id]);
   const mesh=new THREE.Mesh(proto.geometry,proto.material.clone());
   mesh.material.uniforms.uKind.value=id;
   if(id===3||id===4)mesh.material.uniforms.uStorm.value=1;
   
   // Loose bands, staggered in depth, rather than a tiled grid.
   const x=(i%3-1)*14+(r()-.5)*8,y=(r()-.5)*13,z=-(i<3?0:18+r()*17);
   mesh.position.set(x,y,z);const s=.85+r()*.65;mesh.scale.setScalar(s);
   mesh.rotation.y=(r()-.5)*.8;mesh.rotation.z=(r()-.5)*.08;
   if(id===0){const positions=[[9,-3,-9],[-16,1,-16],[23,4,-39],[-5,-3,-52],[-29,1,-64],[34,-2,-78]];mesh.position.set(...positions[i]);mesh.scale.setScalar(i===0?1.65:i<2?1.25:1.05);}
   if([1,5,9].includes(id)){mesh.rotation.x=.3;mesh.position.set((i-1)*14+6,(i-1)*2.5,-i*17);mesh.scale.setScalar(i===1?1.25:.9);}
   if([2,4,6,8].includes(id)){mesh.rotation.x=.16;mesh.rotation.z=-.04;mesh.position.set(6-i*12,(id===4?3:0)-i*3,-i*30);mesh.scale.setScalar(i===0?1.25:1.1);}
   if(id===3){mesh.position.set(7,-7,-8);mesh.scale.setScalar(1.1);mesh.rotation.y=.14;}
   if(id===7){mesh.position.set((i-1)*13+5,(i-1)*4,-i*13);mesh.rotation.z=-.12;mesh.scale.setScalar(1.1);}
   // Distinct cloud families: broad sheets, rounded heaps, feathered streaks and fine grains.
   if([2,4,6,8].includes(id)){mesh.scale.x*=1.3;mesh.scale.y*=id===8?.48:id===2?.55:.7;}
   if(id===7){mesh.scale.x*=1.22;mesh.scale.y*=.72;mesh.rotation.z=-.2+i*.07;}
   if(id===9){mesh.scale.multiplyScalar(.72);mesh.position.y=(i-1)*1.2;}
   if(id===5){mesh.scale.y*=.85;mesh.rotation.z=(i-1)*.04;}
   cloudMaterials.push(mesh.material);
   mesh.userData={x:mesh.position.x,y:mesh.position.y,s,phase:r()*6.28,speed:.25+r()*.25};group.add(mesh);
 }
 layers.push(group);
}
// Sparse lightning geometry shares the cloud's depth and sits beneath all HTML cards.
const lightning=new THREE.Group();scene.add(lightning);lightning.visible=false;
let stormElapsed=0,strikeAge=2,nextStrike=2.2,stormWasActive=false,strikeCount=0;
function clearStrike(){
 for(const child of [...lightning.children]){child.geometry.dispose();child.material.dispose();lightning.remove(child);}
}
function strike(){
 clearStrike();
 const mesh=layers[3].children[0];
 const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3());
 const origin=new THREE.Vector3(bounds.min.x+size.x*(.4+Math.random()*.25),bounds.min.y+.65,bounds.max.z+.15);
 lightning.position.copy(origin);lightning.userData.cloudY=layers[3].position.y;lightning.userData.originY=origin.y;
 const length=6+Math.random()*5,points=[new THREE.Vector3(0,0,0)];
 for(let i=1;i<=12;i++)points.push(new THREE.Vector3((Math.random()-.5)*1.3,-length*i/12,(Math.random()-.5)*.18));
 const paths=[points];
 for(const index of [4,7]){
   const p=points[index],dir=Math.random()<.5?-1:1;
   paths.push([p.clone(),p.clone().add(new THREE.Vector3(dir*.9,-.9,0)),p.clone().add(new THREE.Vector3(dir*1.4,-2,0))]);
 }
 paths.forEach((path,i)=>{
   const curve=new THREE.CatmullRomCurve3(path,false,'centripetal',.1);
   for(const halo of [true,false]){
     const geometry=new THREE.TubeGeometry(curve,path.length*2,halo?.105:i?.018:.033,4,false);
     const material=new THREE.MeshBasicMaterial({color:halo?'#b8a0f5':'#ece0ff',transparent:true,opacity:0,depthWrite:false});
     const line=new THREE.Mesh(geometry,material);line.userData.halo=halo;lightning.add(line);
   }
 });
 strikeAge=0;strikeCount++;document.body.dataset.lightningStrike=String(strikeCount);
 dispatchEvent(new Event('cloudthunder'));
}
function updateLightning(dt,active,reduced){
 if(!active||reduced){
   lightning.visible=false;strikeAge=2;stormElapsed=0;nextStrike=2.2;stormWasActive=false;
   layers[3].children.forEach(m=>m.material.uniforms.uLightning.value=0);
   document.body.dataset.lightning='off';return;
 }
 if(!stormWasActive){stormElapsed=0;nextStrike=2.2;stormWasActive=true;}
 stormElapsed+=Math.min(dt,.05);strikeAge+=Math.min(dt,.05);
 if(stormElapsed>=nextStrike){strike();nextStrike=stormElapsed+8+Math.random()*7;}
 const pulse=strikeAge<.6?Math.sin(Math.min(1,strikeAge/.055)*Math.PI/2)*Math.exp(-strikeAge*7):0;
 lightning.position.y=(lightning.userData.originY||0)+layers[3].position.y-(lightning.userData.cloudY||0);
 lightning.visible=pulse>.012;
 lightning.children.forEach(m=>m.material.opacity=pulse*(m.userData.halo?.12:.92));
 layers[3].children.forEach(m=>m.material.uniforms.uLightning.value=pulse);
 document.body.dataset.lightning=lightning.visible?'strike':'waiting';
}

// A luminous disc and a diffused atmospheric halo, rather than a hard wire ring.
const skyLightVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const halo=new THREE.Mesh(new THREE.PlaneGeometry(22,22),new THREE.ShaderMaterial({
 transparent:true,depthWrite:false,vertexShader:skyLightVertex,
 fragmentShader:`varying vec2 vUv;void main(){
 float r=length(vUv-.5);
 float band=exp(-pow((r-.25)/.014,2.));
 float inner=exp(-pow((r-.245)/.005,2.));
 float outer=exp(-pow((r-.263)/.025,2.));
 float a=band*.15+inner*.09+outer*.035;
 vec3 colour=mix(vec3(1.,.79,.61),vec3(.94,.96,1.),smoothstep(.242,.258,r));
 gl_FragColor=vec4(colour,a);
 #include <colorspace_fragment>
 }`}));
halo.position.set(7,4,-22);scene.add(halo);
const sun=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShaderMaterial({
 transparent:true,depthWrite:false,vertexShader:skyLightVertex,
 fragmentShader:`varying vec2 vUv;void main(){
 float r=length(vUv-.5);
 float disc=1.-smoothstep(.072,.076,r);
 float nearGlow=exp(-r*r/ .012)*.38;
 float wideGlow=exp(-r*r/ .065)*.10;
 float a=disc+(1.-disc)*(nearGlow+wideGlow)*(1.-smoothstep(.34,.49,r));
 vec3 colour=mix(vec3(1.,.87,.53),vec3(1.,.96,.74),disc);
 gl_FragColor=vec4(colour,a);
 #include <colorspace_fragment>
 }`}));
sun.position.copy(halo.position);sun.position.z-=.1;scene.add(sun);
const sparkleShape=new THREE.Shape();sparkleShape.moveTo(0,.3);sparkleShape.quadraticCurveTo(.05,.05,.22,0);sparkleShape.quadraticCurveTo(.05,-.05,0,-.3);sparkleShape.quadraticCurveTo(-.05,-.05,-.22,0);sparkleShape.quadraticCurveTo(-.05,.05,0,.3);
const sparkleGeo=new THREE.ShapeGeometry(sparkleShape),sparkles=[];
for(let i=0;i<6;i++){const m=new THREE.Mesh(sparkleGeo,new THREE.MeshBasicMaterial({color:i%2?'#dfa0ed':'#ffe0bf',transparent:true,opacity:.6}));m.position.set((i-2.5)*8,Math.sin(i*2)*8,-12-i*4);m.visible=false;scene.add(m);sparkles.push(m);}
const rain=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,5),new THREE.MeshBasicMaterial({color:'#c4cafa',transparent:true,opacity:.65}),48);rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(rain);const rainDummy=new THREE.Object3D();
let w=innerWidth,h=innerHeight,quality=1,time=0,last=0,previous=0,mix=1;
S.resize=(width,height)=>{bgKey=-1;w=width;h=height;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)*quality);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?62:48;camera.updateProjectionMatrix();};S.resize(w,h);
S.lowerQuality=()=>{if(quality<=.7)return false;quality=Math.max(.7,quality-.15);S.resize(w,h);return true;};S.raiseQuality=()=>false;
function prepare(id,alt,opacity=1,ground=false){
 layers.forEach((g,j)=>{g.visible=j===id;});const g=layers[id];
 g.position.y=ground?0:clamp((levels[id]-alt)/1800,-2.5,2.5)*13;
 for(const mesh of g.children){const d=mesh.userData;mesh.position.x=d.x+Math.sin(time*.07+d.phase)*2;mesh.position.y=d.y;const alpha=opacity*(id===8?.2:id===6?.65:id===7?.82:1);mesh.material.transparent=alpha<.999;mesh.material.opacity=alpha;mesh.material.uniforms.uOpacity.value=alpha;mesh.material.uniforms.uMotion.value=ground||window.SkyPreferences?.reduced?0:1;mesh.material.depthWrite=alpha>.98;}
 return g;
}
S.render=({alt=0,clearSky=false,weatherRain=null,activeId=null,waterCard=null,waterOpacity=1,selections={low:0,mid:5,high:7},dt=.016})=>{
 const reduced=window.SkyPreferences?.reduced;time+=reduced?0:Math.min(dt,.05);
 const targetNight=document.body.classList.contains('night-sky')?1:0;
 if(targetNight!==phaseTarget){
   phaseTarget=targetNight;phaseStart=nightBlend;phaseElapsed=0;
   phaseDuration=reduced?.65:Math.max(.6,3.2*Math.abs(phaseTarget-phaseStart));
 }
 phaseElapsed+=Math.min(dt,.05);
 const phaseProgress=clamp(phaseElapsed/phaseDuration,0,1);
 nightBlend=THREE.MathUtils.lerp(phaseStart,phaseTarget,softStep(0,1,phaseProgress));
 if(phaseProgress===1)nightBlend=phaseTarget;
 const stormTarget=weatherRain!==null?clamp(weatherRain,0,1):(activeId===3||activeId===4)?clamp(waterOpacity,0,1):0;
 stormBlend=THREE.MathUtils.damp(stormBlend,stormTarget,reduced?7:3.6,Math.min(dt,.05));
 if(Math.abs(stormBlend-stormTarget)<.002)stormBlend=stormTarget;
 document.body.dataset.storm=stormBlend.toFixed(3);
 const light=window.SunLight||{x:.755,y:.12};
 const lightX=(light.x-.5)*2,lightY=(.5-light.y)*2;
 cloudMaterials.forEach(m=>{m.uniforms.uSunDir.value.set(lightX,lightY,1.2);m.uniforms.uSunLow.value=softStep(.4,.9,light.y);m.uniforms.uGloom.value=stormBlend;m.uniforms.uNight.value=nightBlend;m.uniforms.uTime.value=time;m.uniforms.uMotion.value=reduced?0:1;});
 const id=activeId??(alt<2700?selections.low:alt<7000?selections.mid:selections.high);
 if(id!==last){previous=last;last=id;mix=0;}mix=reduced?1:Math.min(1,mix+dt*2);
 background(alt,true);celestialMotion(reduced,id);prepare(id,alt,mix);
 rain.visible=false; // Falling rain is temporarily disabled.
 if(rain.visible){for(let i=0;i<48;i++){const r=rand(i*79+83),x=(r()-.5)*22+6,y=layers[id].position.y-4-((r()*13+time*(2+r()*2))%14);rainDummy.position.set(x,y,-r()*10);rainDummy.scale.set(.035,.16,.035);rainDummy.updateMatrix();rain.setMatrixAt(i,rainDummy.matrix);}rain.instanceMatrix.needsUpdate=true;}
 halo.visible=false;sun.visible=false;for(let i=0;i<sparkles.length;i++)sparkles[i].material.opacity=.28+Math.sin(time*.7+i)*.18;
 if(mix<1){const g=layers[previous];g.visible=true;g.position.y=clamp((levels[previous]-alt)/1800,-2.5,2.5)*13;for(const m of g.children){m.material.transparent=true;m.material.opacity=(1-mix)*(previous===8?.2:previous===6?.65:previous===7?.82:1);m.material.uniforms.uOpacity.value=m.material.opacity;m.material.depthWrite=false;}}
 updateLightning(dt,!clearSky&&activeId===3&&waterOpacity>.6,reduced);
 camera.position.set(0,0,w<h?42:34);camera.lookAt(w>900?-2:0,1,0);
 // SVG sky sits behind the transparent cloud canvas, so clouds occlude the stars.
 scene.background=null;
 if(clearSky){layers.forEach(g=>g.visible=false);lightning.visible=false;}
 if(!glassRain.render({scene,camera,card:waterCard,time,reduced,width:w,height:h,opacity:waterOpacity})){renderer.setRenderTarget(null);renderer.render(scene,camera);}
 windowRain.render({weatherRain,id:clearSky?-1:id,activeId:clearSky?null:activeId,visibility:clearSky?0:waterOpacity,sky:canvas,background:bg,reduced,dt});
 scene.background=texture;
 document.body.dataset.cloudType=clearSky?'clear':labels[id];canvas.setAttribute('aria-label',clearSky?'Clear sky at this altitude':window.CLOUDS.find(c=>c.id===id)?.look||labels[id]);
};
const spot=document.createElement('canvas');spot.className='spotter-canvas';let rt=null;
S.spotter={canvas:spot,vfov:60,render(id,width,height){
 const key=id+':'+width+':'+height+':'+(nightBlend===0?'day':nightBlend===1?'night':'transition')+':'+Math.round(stormBlend*4)+':'+Math.round((window.SunLight?.x??.755)*3)+':'+Math.round((window.SunLight?.y??.12)*3);if(key===this.key)return;this.key=key;
 spot.width=width;spot.height=height;rt?.dispose();rt=new THREE.WebGLRenderTarget(width,height);rt.texture.colorSpace=THREE.SRGBColorSpace;
 const savedLightning=layers[3].children.map(m=>m.material.uniforms.uLightning.value);layers[3].children.forEach(m=>m.material.uniforms.uLightning.value=0);const savedBolt=lightning.visible;lightning.visible=false;const savedSun=sun.visible;sun.visible=(id===6||id===8)&&nightBlend<.5;const savedRain=rain.visible;rain.visible=false;const savedHalo=halo.visible;halo.visible=id===8&&nightBlend<.5;const saved=layers.map(g=>({visible:g.visible,y:g.position.y}));prepare(id,levels[id],1,true);background(1200);
 const cam=new THREE.PerspectiveCamera(52,width/height,.1,500);cam.zoom=id===3?2.2:[0,1,5,9].includes(id)?1.65:1.2;cam.updateProjectionMatrix();this.vfov=cam.getEffectiveFOV();cam.position.set(0,-3,32);cam.lookAt(0,1,0);
 renderer.setRenderTarget(rt);renderer.render(scene,cam);const bytes=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(rt,0,0,width,height,bytes);renderer.setRenderTarget(null);
 const c=spot.getContext('2d'),data=c.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(bytes.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);c.putImageData(data,0,0);
 saved.forEach((s,i)=>{layers[i].visible=s.visible;layers[i].position.y=s.y;});halo.visible=savedHalo;rain.visible=savedRain;sun.visible=savedSun;lightning.visible=savedBolt;layers[3].children.forEach((m,i)=>m.material.uniforms.uLightning.value=savedLightning[i]);bgKey=-1;
},async capture(id,width=360,height=203){this.key=null;this.render(id,width,height);return spot.toDataURL('image/png');}};
S.ok=true;document.body.classList.add('has3d','clay-sky','opal-sky');document.body.classList.remove('illustrated');document.body.dataset.renderer='reference-cloud-meshes';
canvas.setAttribute('role','img');canvas.removeAttribute('aria-hidden');
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();S.ok=false;S.unavailable=true;});
}catch(e){S.unavailable=true;console.error('Clay sky could not load:',e);}
