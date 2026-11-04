import * as THREE from 'three';
import {createDropField,MAX_DROPS} from './drop-field.js?v=3';

// The sky is drawn once into a GPU texture. The water samples this exact frame,
// then frost and water are composited into the same frame beneath the DOM text.
// All passes stay on the GPU; no canvas copies or readPixels loop.
export function createLiveGlassRain(renderer){
 const screenScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,-1,1);
 const geometry=new THREE.PlaneGeometry(2,2);
 const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
 const blit=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{uSky:{value:null}},vertexShader:vertex,
  fragmentShader:`uniform sampler2D uSky;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(uSky,vUv).rgb,1.);\n#include <colorspace_fragment>\n}`});
 const water=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,blending:THREE.NormalBlending,premultipliedAlpha:true,
  uniforms:{uSky:{value:null},uOpacity:{value:1},uRadius:{value:26},uRect:{value:new THREE.Vector4()},uViewport:{value:new THREE.Vector2()},
   uDrops:{value:Array.from({length:MAX_DROPS},()=>new THREE.Vector4())},uAmounts:{value:new Float32Array(MAX_DROPS)}},
  vertexShader:vertex,
  fragmentShader:`
   uniform sampler2D uSky;uniform float uOpacity;uniform float uRadius;uniform vec4 uRect;uniform vec2 uViewport;
   uniform vec4 uDrops[${MAX_DROPS}];uniform float uAmounts[${MAX_DROPS}];varying vec2 vUv;
   void main(){
    vec2 pixel=vec2(vUv.x,1.-vUv.y)*uRect.zw;
    vec2 slope=vec2(0.);float coverage=0.;
    for(int i=0;i<${MAX_DROPS};i++){
     vec4 drop=uDrops[i];if(drop.z<.1)continue;
     vec2 q=(pixel-drop.xy)/drop.zw;
     // Slightly asymmetric water lens, without a drawn border.
     q.x*=1.+.055*q.y;
     float f=1.-dot(q,q);if(f<=0.)continue;
     float root=sqrt(max(f,.025));float amount=uAmounts[i];
     slope+=-q/(drop.zw*max(root,.16))*drop.z*.38*amount;
     coverage=max(coverage,smoothstep(0.,.14,f)*min(1.,amount*3.));
    }
    vec2 skyUv=vec2((uRect.x+pixel.x)/uViewport.x,1.-(uRect.y+pixel.y)/uViewport.y);
    vec2 blur=vec2(16.)/uViewport;
    vec3 frost=texture2D(uSky,skyUv).rgb*.20;
    frost+=(texture2D(uSky,skyUv+vec2(blur.x,0.)).rgb+texture2D(uSky,skyUv-vec2(blur.x,0.)).rgb+texture2D(uSky,skyUv+vec2(0.,blur.y)).rgb+texture2D(uSky,skyUv-vec2(0.,blur.y)).rgb)*.12;
    frost+=(texture2D(uSky,skyUv+blur).rgb+texture2D(uSky,skyUv-blur).rgb+texture2D(uSky,skyUv+vec2(blur.x,-blur.y)).rgb+texture2D(uSky,skyUv+vec2(-blur.x,blur.y)).rgb)*.08;
    frost=mix(frost,vec3(.94,.95,1.),mix(.18,.32,vUv.y));
    vec2 bend=vec2(slope.x,-slope.y)*7.5/uViewport;
    vec3 sky=texture2D(uSky,clamp(skyUv+bend,vec2(.001),vec2(.999))).rgb;
    vec3 normal=normalize(vec3(-slope.x,slope.y,1.));
    vec3 light=normalize(vec3(.45,.7,1.));
    float spec=pow(max(0.,dot(normal,normalize(light+vec3(0.,0.,1.)))),60.);
    float rim=pow(1.-normal.z,2.);
    // A wet spot is clearer than the frosted pane, with a restrained warm glint.
    vec3 colour=mix(sky,vec3(.84,.90,1.),.13);
    colour*=1.-rim*.10;colour+=vec3(1.,.98,.93)*(spec*.55+rim*.11);
    colour=mix(frost,colour,coverage*.94);
    vec2 edge=abs(pixel-uRect.zw*.5)-uRect.zw*.5+uRadius;
    float distance=length(max(edge,0.))+min(max(edge.x,edge.y),0.)-uRadius;
    float rounded=1.-smoothstep(-.7,.7,distance);
    gl_FragColor=vec4(colour,rounded*uOpacity);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
   }`});
 const quad=new THREE.Mesh(geometry,blit);quad.frustumCulled=false;screenScene.add(quad);
 const states=new WeakMap();const bufferSize=new THREE.Vector2();let skyTarget=null,frame=0,lastCard=null;
 function release(){if(lastCard){lastCard.classList.remove('live-water-pane');lastCard=null;}}
 function stateFor(card,surface,time){
  let state=states.get(surface);
  if(!state){state={field:createDropField(),epoch:time,w:0,h:0,radius:26};states.set(surface,state);}
  const w=card.clientWidth,h=card.clientHeight;
  if(w!==state.w||h!==state.h){state.w=w;state.h=h;state.radius=Math.max(0,parseFloat(getComputedStyle(card).borderTopLeftRadius)-1);}
  return state;
 }
 return {render({scene,camera,card,time,reduced,width,height,opacity=1}){
  const surface=card?.querySelector('.glass-water-surface');
  if(!surface||!card.isConnected){release();return false;}
  const bounds=card.getBoundingClientRect();
  if(bounds.bottom<0||bounds.top>height||bounds.right<0||bounds.left>width||bounds.width<40){release();return false;}
  if(lastCard!==card){release();lastCard=card;card.classList.add('live-water-pane');}
  const state=stateFor(card,surface,time);if(state.w<1||state.h<1)return false;
  const x=bounds.left+card.clientLeft,y=bounds.top+card.clientTop,cw=state.w,ch=state.h;
  renderer.getDrawingBufferSize(bufferSize);
  if(!skyTarget||skyTarget.width!==bufferSize.x||skyTarget.height!==bufferSize.y){
   skyTarget?.dispose();skyTarget=new THREE.WebGLRenderTarget(bufferSize.x,bufferSize.y,{depthBuffer:true,generateMipmaps:false});
   skyTarget.texture.colorSpace=THREE.LinearSRGBColorSpace;
   water.uniforms.uSky.value=skyTarget.texture;blit.uniforms.uSky.value=skyTarget.texture;
  }
  const sampled=state.field.sample(cw,ch,time-state.epoch,reduced);
  for(let i=0;i<MAX_DROPS;i++){
   const d=sampled.drops[i];water.uniforms.uDrops.value[i].set(d?.x||0,d?.y||0,d?.rx||0,d?.ry||0);water.uniforms.uAmounts.value[i]=d?.amount||0;
  }
  water.uniforms.uRect.value.set(x,y,cw,ch);water.uniforms.uViewport.value.set(width,height);
  water.uniforms.uRadius.value=state.radius;water.uniforms.uOpacity.value=opacity;
  const autoClear=renderer.autoClear;
  // Draw the sky once, then composite its live glass region directly on screen.
  renderer.setScissorTest(false);renderer.setRenderTarget(skyTarget);renderer.autoClear=true;renderer.render(scene,camera);
  renderer.setRenderTarget(null);renderer.setViewport(0,0,width,height);quad.material=blit;renderer.render(screenScene,quadCamera);
  renderer.autoClear=false;renderer.setViewport(x,height-y-ch,cw,ch);renderer.setScissor(x,height-y-ch,cw,ch);renderer.setScissorTest(true);
  quad.material=water;renderer.render(screenScene,quadCamera);
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.autoClear=autoClear;
  surface.dataset.source='live-sky';surface.dataset.motion=reduced?'still':'moving';
  if(++frame%15===0){surface.dataset.frames=String(frame);surface.dataset.drops=String(sampled.drops.length);surface.dataset.merges=String(sampled.merges);}
  return true;
 }};
}
