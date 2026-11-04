import bpy, math, random
from pathlib import Path
ROOT=Path('/Users/aleenahussain/Documents/Codex/2026-10-23/the-challenge-the-content-of-your/outputs/clay-sky')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Warm porcelain • lavender shadows');mat.diffuse_color=(1,.80,.76,1);mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,.80,.76,1);bs.inputs['Roughness'].default_value=.85
protos=[]
def build(name,lobes,merge=True):
 parts=[]
 for x,y,z,sx,sy,sz in lobes:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(x,y,z));ob=bpy.context.object;ob.scale=(sx,sy,sz);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);parts.append(ob)
 bpy.ops.object.select_all(action='DESELECT')
 for ob in parts:ob.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();ob=parts[0];ob.name=name
 if merge:
  m=ob.modifiers.new('Joined soft clay','REMESH');m.mode='VOXEL';m.voxel_size=.14;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
  m=ob.modifiers.new('Soften joins','SMOOTH');m.factor=1.1;m.iterations=7;bpy.ops.object.modifier_apply(modifier=m.name)
  m=ob.modifiers.new('Browser mesh budget','DECIMATE');m.ratio=.38;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in ob.data.polygons:p.use_smooth=True
 ob.data.materials.clear();ob.data.materials.append(mat)
 bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
 protos.append(ob)
 return ob
for i in range(3):
 r=random.Random(91+i*11)
 lobes=[(-3,0,0,2.2,1.5,.85),(0,0,0,3,1.65,.85),(3,0,0,2.1,1.3,.8),(-2,0,.8,1.8,1.55,1.7),(0.1,0,1.2,2.1,1.7,2.4),(2.4,0,1,1.7,1.3,1.65)]
 lobes=[(x+r.uniform(-.35,.35),y,z+r.uniform(-.2,.2),sx,sy,sz) for x,y,z,sx,sy,sz in lobes]
 build('Cu_'+str(i),lobes)
for name,size,cols,rows in [('Sc',1.3,4,2),('Ac',.75,5,3),('Cc',.33,8,4)]:
 r=random.Random(89);lobes=[]
 for j in range(rows):
  for i in range(cols):
   if r.random()<.12:continue
   x=(i-(cols-1)/2)*size*2;y=(j-(rows-1)/2)*size*2.6
   lobes.append((x+r.uniform(-.2,.2),y,r.uniform(-.15,.15),size,size*.85,size*.7))
 build(name,lobes,name=='Sc')
for name,zscale in [('St',.45),('As',.3),('Ns',.85),('Cs',.12)]:
 build(name,[(-3,0,0,3,2,zscale),(0,0,.12,3.6,2.4,zscale*1.3),(3,0,0,2.8,1.8,zscale)])
build('Cb',[(-2,0,0,2.4,1.6,.9),(1,0,0,2.5,1.7,1),(-.8,0,1.5,1.6,1.4,2.4),(.2,0,3.7,1.8,1.5,2.5),(0,0,5.7,1.6,1.4,2),(0,0,7.1,3.8,1.7,.75),(-2.7,0,7.2,2,1.4,.55),(2.7,0,7.15,2.2,1.4,.55)])
lobes=[]
for j in range(3):
 for i in range(9):
  t=i/8;x=-4+t*8;y=j*1.25+math.sin(t*3)*.55;z=math.sin(t*2.4)*.25
  lobes.append((x,y,z,.85-.45*t,.25,.18))
build('Ci',lobes)
# Export the prototypes at the origin so the website can instance them cheaply.
bpy.ops.object.select_all(action='DESELECT')
for ob in protos:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'clay-clouds.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
# Arrange the editable prototypes into a source gallery after exporting.
for i,ob in enumerate(protos):ob.location=((i%4)*15,(i//4)*16,0)
bpy.ops.object.light_add(type='AREA',location=(-10,-8,18));bpy.context.object.name='Peach softbox';bpy.context.object.data.energy=2200;bpy.context.object.data.color=(1,.55,.35);bpy.context.object.data.shape='DISK';bpy.context.object.data.size=12
bpy.ops.object.light_add(type='AREA',location=(30,10,16));bpy.context.object.name='Lavender fill';bpy.context.object.data.energy=1800;bpy.context.object.data.color=(.5,.35,1);bpy.context.object.data.size=15
bpy.context.scene.world.color=(.06,.08,.25)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'clay-cloud-study.blend'))
print('CLAY STUDY READY',len(protos),'prototypes')
