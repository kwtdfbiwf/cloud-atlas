import bpy, math, random
from pathlib import Path
ROOT=Path('/Users/aleenahussain/Documents/Codex/2026-10-23/the-challenge-the-content-of-your/outputs/cloud-shape-rework')
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
  m=ob.modifiers.new('Joined soft clay','REMESH');m.mode='VOXEL';m.voxel_size=.085 if name=='Cc' else .11 if name=='Ac' else .14;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
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
# Chunky connected rolls, rather than a row of smooth beads.
r=random.Random(42);lobes=[(-3,0,0,4,2.6,.7),(2,0,0,4.5,2.7,.75)]
# Unequal connected heaps spread into one broad low bank.
for x,y,z,s in [(-5,-.5,.5,1.4),(-3.2,.4,.65,1.8),(-.6,-.8,.8,2),(1.4,.5,.7,1.7),(3.4,-.6,.4,1.9),(5.3,.1,.3,1.3),(-2.2,2,.4,1.4),(1.1,2,.5,1.6)]:
 lobes.append((x,y,z,s,s*.85,s*.72))
build('Sc',lobes)
# Rounded little tufts, with gaps and irregular staggered rows.
for name,size,cols,rows in [('Ac',.85,5,3),('Cc',.36,8,4)]:
 r=random.Random(129 if name=='Ac' else 641);lobes=[]
 for row in range(rows):
  for col in range(cols):
   if r.random()<.17:continue
   x=(col-(cols-1)/2)*size*3.5+(row%2)*size*.9+r.uniform(-.7,.7)
   y=(row-(rows-1)/2)*size*3.9+r.uniform(-.55,.55);z=r.uniform(-.08,.08);size2=size*r.uniform(.72,1.22)
   lobes.extend([(x,y,z,size2*1.2,size2*.85,size2*.48),(x-size2*.45,y,z+size2*.3,size2*.7,size2*.6,size2*.65),(x+size2*.3,y,z+size2*.5,size2*.8,size2*.65,size2*.9)])
 build(name,lobes,True)
# A continuous irregular blanket with a softly rolling top, not separate pancakes.
def sheet(name,sx,sy,sz,seed):
 r=random.Random(seed);lobes=[]
 for row in range(2):
  for i in range(7):
   x=(i-3)*3.05+r.uniform(-.6,.6);y=(row-.5)*3+r.uniform(-.55,.55)
   z=r.uniform(-.18,.18)
   lobes.append((x,y,z,2.5+r.random()*.7,2.4+r.random()*.5,sz*(.85+r.random()*.35)))
 # Connected low billows retain a cloudy edge without becoming detached blobs.
 build(name,lobes)
sheet('St',12,8,1.,2)
sheet('As',14,9,.72,3)
sheet('Ns',13,9,1.9,4)
sheet('Cs',15,10,.36,5)
# A single substantial thunderhead with a broad, flattened spreading anvil.
lobes=[(-2,0,.1,3.1,2,1.4),(1,0,.1,3.2,2,1.35),(-1.2,0,1.7,2.9,2,2.4),(-.8,0,3.7,3.15,2.1,2.8),(-.8,0,5.8,3.5,2,2.4),(-1,0,6.7,3.5,2.1,1.65),(1.8,0,7.1,3,2,.95),(4.2,0,7.45,2.5,1.7,.53),(5.8,0,7.5,1.5,1.3,.35)]
for x,z,radius in [(-3,1.4,1.55),(-2.8,3.5,1.8),(1.7,2.4,1.8),(2,4.3,1.7),(-2,6.1,1.9),(1.1,6.5,1.6)]:lobes.append((x,-.7,z,radius,1.6,radius))
build('Cb',lobes)
# Tapered swept hooks: curves remain silky instead of becoming strings of balls.
parts=[]
r=random.Random(148)
for row in range(6):
 cv=bpy.data.curves.new('Feathered hook','CURVE');cv.dimensions='3D';cv.resolution_u=16;cv.bevel_depth=.48 if row<3 else .2;cv.bevel_resolution=3
 sp=cv.splines.new('BEZIER');sp.bezier_points.add(5)
 shift=r.uniform(-.7,.7);length=r.uniform(.8,1.15)
 coords=[(-6*length+shift,0,-.7+row*.19),(-3*length,0,-.4+row*.24),(-.3,0,.4+row*.33),(2.2*length,0,1.5+row*.32),(3.4*length,0,2+row*.27),(2.9*length,0,2.8+row*.27)]
 for i,bp in enumerate(sp.bezier_points):
  x,y,z=coords[i];bp.co=(x,y+r.uniform(-.3,.3),z+r.uniform(-.12,.12));bp.radius=[.07,.65,1.,.75,.43,.04][i];bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
 ob=bpy.data.objects.new('Silky strand',cv);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');parts.append(bpy.context.object);ob.select_set(False)
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();ob=parts[0];ob.name='Ci'
for f in ob.data.polygons:f.use_smooth=True
ob.data.materials.append(mat);protos.append(ob)
# Export the prototypes at the origin so the website can instance them cheaply.
bpy.ops.object.select_all(action='DESELECT')
for ob in protos:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'clay-clouds.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
# Arrange the editable prototypes into a source gallery after exporting.
for i,ob in enumerate(protos):ob.location=((i%4)*15,(i//4)*16,0)
bpy.ops.object.light_add(type='AREA',location=(-10,-8,18));bpy.context.object.name='Peach softbox';bpy.context.object.data.energy=2200;bpy.context.object.data.color=(1,.55,.35);bpy.context.object.data.shape='DISK';bpy.context.object.data.size=12
bpy.ops.object.light_add(type='AREA',location=(30,10,16));bpy.context.object.name='Lavender fill';bpy.context.object.data.energy=1800;bpy.context.object.data.color=(.5,.35,1);bpy.context.object.data.size=15
bpy.context.scene.world.color=(.06,.08,.25)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'cloud-shape-study.blend'))
print('CLAY STUDY READY',len(protos),'prototypes')
