const params=new URLSearchParams(location.search);
let webgl2=false;
if(!params.has('lightweight')&&!params.has('no-webgl2')){
 try{const probe=document.createElement('canvas'),context=probe.getContext('webgl2');webgl2=!!context;context?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
}
if(webgl2){try{await import('./scene3d.js?v=discoveries-32');}catch(error){window.Scene3D={ok:false,unavailable:true};console.warn('Using the photo sky:',error);}}
else window.Scene3D={ok:false,unavailable:true,fallback:true};
