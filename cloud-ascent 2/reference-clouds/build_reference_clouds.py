import bpy, math, random, json
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Reference • pastel billows');mat.use_nodes=True;mat.diffuse_color=(.8,.7,.9,1)
nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=1
vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='CloudColour';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
# Geometry receives painted soft lighting and local occlusion offline.
protos=[];stats=[]
def blend(a,b,f):return [x*(1-f)+y*f for x,y in zip(a,b)]
def paint(ob,shadow=True):
 ob.data.update();verts=ob.data.vertices
 tree=BVHTree.FromPolygons([v.co.copy() for v in verts],[p.vertices[:] for p in ob.data.polygons],all_triangles=False) if shadow else None
 rays=[Vector(v).normalized() for v in [(1,-.8,1.8),(1.5,-.4,1.7),(.6,-1,1.5)]]
 attr=ob.data.color_attributes.new(name='CloudColour',type='FLOAT_COLOR',domain='POINT')
 for v in verts:
  n=v.normal;p=v.co;up=max(0,n.z);left=max(0,-n.x);right=max(0,n.x)
  col=blend((.59,.65,.88),(.90,.85,.98),.35+.65*up)
  col=blend(col,(.32,.82,.96),left*.60)
  col=blend(col,(1.,.74,.51),right*.75)
  pink=max(0,-n.y)*(.28+.14*math.sin(p.x*.5+p.z*.6))
  col=blend(col,(.98,.52,.85),pink*1.2)
  col=blend(col,(1.,.94,.68),max(0,(n.x+n.z)*.7-.35)*.35)
  if tree:
   origin=p+n*.035;blocked=sum(tree.ray_cast(origin,d,5)[0] is not None for d in rays)/3
   ao=1-.16*blocked
   col=[c*ao for c in col]
  attr.data[v.index].color=(*(max(0,c)**2.2 for c in col),1)
 # Smooth the baked light to avoid discrete ray-sample speckling.
 colours=np.array([d.color[:] for d in attr.data],dtype=np.float32)
 edges=np.array([e.vertices[:] for e in ob.data.edges],dtype=np.int32)
 degree=np.ones(len(verts),dtype=np.float32)
 np.add.at(degree,edges[:,0],1);np.add.at(degree,edges[:,1],1)
 for _ in range(3):
  accum=colours.copy();np.add.at(accum,edges[:,0],colours[edges[:,1]]);np.add.at(accum,edges[:,1],colours[edges[:,0]]);colours=accum/degree[:,None]
 for d,col in zip(attr.data,colours):d.color=col
 ob.data.color_attributes.active_color=attr
 ob.data.materials.clear();ob.data.materials.append(mat)
 for f in ob.data.polygons:f.use_smooth=True

def build(name,lobes,voxel=.13,detail=True):
 vertices=[];faces=[];segments=16;rings=10
 for x,y,z,sx,sy,sz in lobes:
  off=len(vertices)
  for j in range(rings+1):
   phi=math.pi*j/rings
   for i in range(segments):
    theta=math.tau*i/segments
    vertices.append((x+sx*math.sin(phi)*math.cos(theta),y+sy*math.sin(phi)*math.sin(theta),z+sz*math.cos(phi)))
  for j in range(rings):
   for i in range(segments):
    a=off+j*segments+i;b=off+j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 mesh=bpy.data.meshes.new(name+' • sculpt');mesh.from_pydata(vertices,[],faces);mesh.update()
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 rem=ob.modifiers.new('Merge soft billows','REMESH');rem.mode='VOXEL';rem.voxel_size=voxel;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
 sm=ob.modifiers.new('Round the joins','SMOOTH');sm.factor=.8;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
 dec=ob.modifiers.new('Browser surface budget','DECIMATE');dec.ratio=.38;bpy.ops.object.modifier_apply(modifier=dec.name)
 paint(ob,detail);ob.select_set(False);protos.append(ob);stats.append({'name':name,'vertices':len(ob.data.vertices),'faces':len(ob.data.polygons)})
 print('BUILT',name,len(ob.data.vertices),flush=True)
 return ob

def billows(lobes,seed,count=5,ratio=.28):
 r=random.Random(seed);out=list(lobes)
 for x,y,z,sx,sy,sz in lobes:
  if sz<.3:continue
  for k in range(count):
   angle=r.uniform(0,math.tau);height=r.uniform(-.1,1.0);rad=math.sqrt(max(0,1-height*height));q=min(sx,sy,sz)*ratio*r.uniform(.8,1.35)
   out.append((x+math.cos(angle)*sx*rad*.94,y+math.sin(angle)*sy*rad*.94,z+height*sz*.94,q*1.3,q,q*1.2))
 return out
# Full cloud sculptures, not six intersecting ellipsoids.
for i in range(3):
 r=random.Random(27+i*17);lobes=[]
 for x,y,z,sx,sy,sz in [(-3,0,0,2.7,1.9,.85),(0,0,0,3.1,2,.9),(3,0,0,2.4,1.7,.8),(-2,0,1.1,2.3,1.8,2),(.2,0,2.1,2.5,2,3),(2.5,0,1.2,2,1.7,2.1),(-.9,-.8,3.6,1.8,1.6,2)]:
  lobes.append((x+r.uniform(-.3,.3),y+r.uniform(-.2,.2),z*(.75+i*.16),sx,sy,sz*(.8+i*.12)))
 build('Cu_'+str(i),billows(lobes,91+i,8,.28),.12)
# Connected cloud streets with cloud-sized soft humps and smaller billows.
r=random.Random(88);lobes=[]
for row in range(3):
 for col in range(4):
  if r.random()<.15:continue
  lobes.append(((col-1.5)*3.3+r.uniform(-.7,.7),(row-1)*3.1+r.uniform(-.6,.6),r.uniform(-.2,.3),2.5,2,1.2+r.random()*.7))
build('Sc',billows(lobes,37,6,.3),.14)
# A soft deep blanket with low surface billows, not a plate or a row of beads.
def blanket(name,thickness,seed,detail):
 r=random.Random(seed);lobes=[]
 for row in range(3):
  for col in range(5):
   lobes.append(((col-2)*3.5+r.uniform(-.5,.5),(row-1)*3.3+r.uniform(-.5,.5),r.uniform(-.15,.15),3,2.7,thickness*r.uniform(.85,1.2)))
 build(name,billows(lobes,seed+6,detail,.27) if detail else lobes,.16,detail>0)
blanket('St',.9,5,2)
blanket('As',.58,9,0)
blanket('Ns',2.,17,8)
blanket('Cs',.24,11,0)
# Cloudlet fields: many little connected puffs, with irregular gaps and a size hierarchy.
for name,size,cols,rows in [('Ac',.78,5,3),('Cc',.37,8,4)]:
 r=random.Random(73 if name=='Ac' else 113);lobes=[]
 for row in range(rows):
  for col in range(cols):
   if r.random()<.17:continue
   x=(col-(cols-1)/2)*size*3.7+r.uniform(-.5,.5);y=(row-(rows-1)/2)*size*4+r.uniform(-.5,.5);ss=size*r.uniform(.75,1.25)
   tiny=[(x,y,0,ss*1.4,ss,.45*ss),(x-ss*.55,y,.4*ss,.8*ss,.7*ss,.8*ss),(x+.2*ss,y,.65*ss,.95*ss,.8*ss,ss),(x+.85*ss,y,.25*ss,.65*ss,.65*ss,.65*ss)]
   lobes.extend(billows(tiny,row*87+col,3,.25))
 build(name,lobes,.095 if name=='Ac' else .065)
# Towering billows spreading against the high flat ceiling.
lobes=[(-2,0,0,3,2,1.1),(1.5,0,0,3.2,2.1,1.2),(-1,0,2,3,2.2,2.8),(-.6,0,4.7,3.2,2.3,3),(-1,0,7,3.6,2.5,2.6),(-1.7,0,8.5,3.9,2.6,1.7)]
for x,z,s in [(-4,9,2),(-1,9.3,2.6),(2,9.5,2.6),(4.5,9.6,2.4),(6.5,9.65,1.8)]:lobes.append((x,0,z,s,2,s*.34))
for x,z in [(-3,2),(-3,4.4),(2,3),(2,5.8),(-2.8,7.5)]:lobes.append((x,-1,z,1.8,1.8,2))
build('Cb',billows(lobes,189,11,.29),.13)
# Fine cloud feathers: broad tapered plume with many fan-shaped strands.
parts=[]
def strand(name,coords,radius,radii):
 cv=bpy.data.curves.new(name,'CURVE');cv.dimensions='3D';cv.resolution_u=8;cv.bevel_depth=radius;cv.bevel_resolution=2
 sp=cv.splines.new('BEZIER');sp.bezier_points.add(len(coords)-1)
 for bp,co,rr in zip(sp.bezier_points,coords,radii):bp.co=co;bp.radius=rr;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cv);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');parts.append(bpy.context.object);ob.select_set(False)
r=random.Random(215)
for p in range(3):
 shift=p*.7
 strand('Plume core',[(-6,0,shift-.8),(-2,0,shift-.2),(1,0,shift+1),(3.8,0,shift+2),(4.3,0,shift+3)],.23,[.04,.8,1,.6,.02])
for i in range(42):
 t=r.uniform(.05,.95);x=-5.5+9*t;z=t*t*2+r.uniform(-.2,.2);length=r.uniform(1.5,3.6)
 strand('Feather filament',[(x-2,0,z-.3),(x-.8,r.uniform(-.3,.3),z+.15),(x+length*.3,0,z+1+r.random()),(x+length*.7,0,z+2+r.random()*1.4)],r.uniform(.018,.05),[.04,1,.65,.01])
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();ob=parts[0];ob.name='Ci';paint(ob,False);protos.append(ob);stats.append({'name':'Ci','vertices':len(ob.data.vertices),'faces':len(ob.data.polygons)})
# Keep prototype origins stable; browser copies the geometry at origin.
bpy.ops.object.select_all(action='DESELECT')
for ob in protos:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'reference-clouds.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_colors=True)
(ROOT/'model-stats.json').write_text(json.dumps(stats,indent=2))
# Editable gallery, named by cloud type; the image used as the visual design reference is packed.
for i,ob in enumerate(protos):ob.location=((i%4)*26,(i//4)*24,0)
img=bpy.data.images.load(str(ROOT/'approved-cloud-grid.png'));img.pack()
bpy.ops.object.empty_add(type='IMAGE',location=(25,50,17));ref=bpy.context.object;ref.name='Approved cloud concept grid';ref.data=img;ref.empty_display_size=90;ref.hide_render=True;ref.hide_viewport=True
bpy.ops.object.light_add(type='AREA',location=(40,-20,40));bpy.context.object.data.energy=3500;bpy.context.object.data.size=20
bpy.context.scene.world.color=(.2,.25,.5)
# Friendly saved viewport: see the model gallery in material preview.
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.shading.type='MATERIAL';area.spaces.active.region_3d.view_distance=95;area.spaces.active.region_3d.view_location=(35,25,0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference-cloud-atlas.blend'))
print('REFERENCE MODELS COMPLETE',len(protos),flush=True)
