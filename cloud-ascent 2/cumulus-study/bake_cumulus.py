"""Offline cumulus density and sunlight bake. Run with Blender --background --python.
After the initial run, edit the lobe objects in the saved study and rerun with
CUMULUS_SOURCE pointing to that .blend file. Outputs are relative to this script.
"""
import bpy, numpy as np, json, os, time, gzip
from pathlib import Path
out=Path(__file__).resolve().parent
source=os.environ.get('CUMULUS_SOURCE','/Users/aleenahussain/Desktop/framer agent/cloud-ascent 3/3d/cloud-ascent.blend')
bpy.ops.wm.open_mainfile(filepath=source)
scene=bpy.data.scenes.get('Cumulus Study')
if scene is None:
 scene=bpy.data.scenes.new('Cumulus Study')
 bpy.context.window.scene=scene
 scene.world=bpy.data.worlds.new('Study daylight');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.42,.7,1)
 scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 mat=bpy.data.materials.new('Cloud volume • source preview');mat.use_nodes=True
 nt=mat.node_tree;nt.nodes.clear();output=nt.nodes.new('ShaderNodeOutputMaterial');vol=nt.nodes.new('ShaderNodeVolumePrincipled');vol.inputs['Density'].default_value=2;vol.inputs['Color'].default_value=(.98,.99,1,1);nt.links.new(vol.outputs['Volume'],output.inputs['Volume'])
 # The three formations have different silhouettes and lobe arrangements.
 forms=[
 [(-.40,-.22,.0,.47,.24,.40),(.02,-.20,.04,.57,.27,.45),(.43,-.20,.01,.40,.25,.34),(-.22,.08,.02,.38,.40,.35),(.15,.22,.0,.34,.47,.35),(.45,.04,.03,.29,.32,.28),(-.48,-.02,.02,.26,.28,.27)],
 [(-.48,-.22,.0,.34,.23,.33),(-.12,-.19,.02,.51,.29,.45),(.34,-.23,.02,.48,.22,.35),(-.15,.16,.0,.36,.45,.36),(-.35,.06,.03,.25,.32,.28),(.12,.01,.01,.32,.32,.34),(.53,-.12,-.04,.27,.23,.26)],
 [(-.42,-.23,.02,.45,.20,.35),(.0,-.18,.0,.56,.27,.42),(.42,-.20,.0,.35,.25,.33),(-.37,.01,.0,.29,.32,.30),(.02,.12,-.04,.37,.41,.32),(.28,.03,.04,.28,.31,.28),(-.06,.34,.0,.23,.28,.25)]]
 for variant,lobes in enumerate(forms):
  col=bpy.data.collections.new('Cumulus %s • editable lobes'%('ABC'[variant]));scene.collection.children.link(col)
  for i,(x,y,z,rx,ry,rz) in enumerate(lobes):
   # Browser y-up -> Blender z-up. Spread variants horizontally in the study.
   bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(x+variant*3,-z,y))
   ob=bpy.context.object;ob.name='BakedCu_%d_lobe_%02d'%(variant,i);ob.scale=(rx,rz,ry)
   for c in list(ob.users_collection):c.objects.unlink(ob)
   col.objects.link(ob);ob['variant']=variant;ob['cloud_lobe']=True;ob.data.materials.append(mat)
   for face in ob.data.polygons:face.use_smooth=True
 scene['bake_readme']='Edit lobe positions/scales. Rerun bake_cumulus.py with CUMULUS_SOURCE set to this file. Browser data uses the editable lobes plus deterministic density erosion and precomputed sunlight.'
 scene.render.engine='CYCLES';scene.cycles.samples=32
 bpy.ops.object.light_add(type='SUN',location=(0,-4,5));bpy.context.object.name='Study sun';bpy.context.object.rotation_euler=(.5,-.4,-.5);bpy.context.object.data.energy=2.5
 bpy.ops.object.camera_add(location=(4,-7,3));cam=bpy.context.object
 from mathutils import Vector
 cam.rotation_euler=(Vector((3,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
else:bpy.context.window.scene=scene
W,H,D=128,96,112
# Voxel storage x-fastest, then y, then z: matches WebGL Data3DTexture.
z,y,x=np.meshgrid(np.linspace(-1,1,D),np.linspace(-.65,.85,H),np.linspace(-1.15,1.15,W),indexing='ij')
points=np.stack((x,y,z),axis=-1).astype(np.float32)
def smooth(a,b,t):
 v=np.clip((t-a)/(b-a),0,1);return v*v*(3-2*v)
def value_noise(p,frequency,seed):
 rng=np.random.default_rng(seed);grid=rng.uniform(-1,1,(40,40,40)).astype(np.float32)
 q=(p+8)*frequency;idx=np.floor(q).astype(int);f=q-idx;f=f*f*f*(f*(f*6-15)+10)
 result=np.zeros(p.shape[:-1],np.float32)
 for iz in range(2):
  for iy in range(2):
   for ix in range(2):
    weights=(f[...,0] if ix else 1-f[...,0])*(f[...,1] if iy else 1-f[...,1])*(f[...,2] if iz else 1-f[...,2])
    result+=grid[(idx[...,2]+iz)%40,(idx[...,1]+iy)%40,(idx[...,0]+ix)%40]*weights
 return result
def trilinear(field,p):
 coord=(p-np.array([-1.15,-.65,-1]))/np.array([2.3,1.5,2])*np.array([W-1,H-1,D-1]);inside=np.all((coord>=0)&(coord<=np.array([W-1,H-1,D-1])),axis=-1)
 coord=np.clip(coord,0,np.array([W-1,H-1,D-1])-1.001);idx=np.floor(coord).astype(int);f=coord-idx;result=np.zeros(field.shape,np.float32)
 for dz in range(2):
  for dy in range(2):
   for dx in range(2):
    weight=(f[...,0] if dx else 1-f[...,0])*(f[...,1] if dy else 1-f[...,1])*(f[...,2] if dz else 1-f[...,2]);result+=field[idx[...,2]+dz,idx[...,1]+dy,idx[...,0]+dx]*weight
 return result*inside
assets=out/'assets';assets.mkdir(exist_ok=True);records=[]
for variant in range(3):
 start=time.time();lobes=[]
 for ob in scene.objects:
  if ob.get('cloud_lobe') and ob.get('variant')==variant:
   lobes.append((np.array([ob.location.x-variant*3,ob.location.z,-ob.location.y]),np.array([ob.scale.x,ob.scale.z,ob.scale.y])))
 assert lobes,'No editable lobes found'
 sdf=np.full((D,H,W),-10.,np.float32)
 for centre,radius in lobes:
  distance=(1-np.linalg.norm((points-centre)/radius,axis=-1))*min(radius)
  # Smooth union, keeping intersecting lobes connected.
  k=.055;h=np.clip(.5+.5*(distance-sdf)/k,0,1);sdf=sdf*(1-h)+distance*h+k*h*(1-h)
 macro=value_noise(points,3.2,101+variant*11);fine=value_noise(points,12.8,204+variant*17);micro=value_noise(points,25.6,306+variant*19)
 edge=sdf+macro*.065+fine*.018+micro*.006
 density=smooth(-.015,.035,edge)*(.52+.28*smooth(-.6,.7,macro)+.16*smooth(-.5,.7,fine))
 density*=smooth(-.47,-.40,y+macro*.015)
 # Precomputed optical depth along the fixed sunlight direction. Browser does no shadow march.
 sun=np.array([.65,.72,.24]);sun/=np.linalg.norm(sun);tau=np.zeros_like(density);step=.065
 for j in range(1,22):tau+=trilinear(density,points+sun*step*(j-.5))*step*9
 sunlight=np.exp(-tau)
 packed=np.stack((np.round(density*255),np.round(sunlight*255)),axis=-1).astype(np.uint8)
 name='cumulus-%s.rg8'%('abc'[variant]);packed.tofile(assets/name)
 compressed=gzip.compress(packed.tobytes(),compresslevel=9)
 (assets/(name+'.gz')).write_bytes(compressed)
 records.append({'name':name,'width':W,'height':H,'depth':D,'bytes':packed.nbytes,'compressedBytes':len(compressed),'gzip':name+'.gz','lobes':len(lobes),'occupied':int(np.sum(density>.01))})
 print('BAKED',name,packed.nbytes,'bytes',round(time.time()-start,2),'sec',flush=True)
(assets/'manifest.json').write_text(json.dumps({'version':1,'format':'RG8','channels':['density','sun_transmittance'],'bounds':[[-1.15,-.65,-1],[1.15,.85,1]],'variants':records},indent=2))
# A new editable project; original scenes are retained in this copy.
bpy.ops.wm.save_as_mainfile(filepath=str(out/'cumulus-study.blend'))
print('CUMULUS_BAKE_COMPLETE',flush=True)
