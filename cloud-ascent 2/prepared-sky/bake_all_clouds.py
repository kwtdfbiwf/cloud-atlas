"""Prepare the nine other cloud types as fixed density + sunlight volumes in Blender."""
import bpy,numpy as np,json,gzip,sys,math,os
from pathlib import Path
root=Path(__file__).resolve().parent;sys.path.insert(0,str(root));import bake_math as bm
requested=os.environ.get('CLOUD_TYPES')
source=root/'cloud-atlas-study.blend' if requested and (root/'cloud-atlas-study.blend').exists() else Path('/Users/aleenahussain/Desktop/framer agent/cloud-ascent 3/3d/cumulus-study.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.data.scenes.get('Cloud types • source shapes') or bpy.data.scenes.new('Cloud types • source shapes');bpy.context.window.scene=scene;scene.world=bpy.data.scenes['Cumulus Study'].world
mat=bpy.data.materials['Cloud volume • source preview']
configs=[('stratocumulus',1,(128,64,112)),('stratus',2,(128,48,112)),('cumulonimbus',3,(128,160,96)),('nimbostratus',4,(128,80,112)),('altocumulus',5,(128,64,128)),('altostratus',6,(128,48,112)),('cirrus',7,(160,48,160)),('cirrostratus',8,(128,48,128)),('cirrocumulus',9,(144,48,144))]
requested=os.environ.get('CLOUD_TYPES');configs=[c for c in configs if not requested or str(c[1]) in requested.split(',')];changed={c[0]+'.rg8' for c in configs}
manifest=json.loads((root/'assets/manifest.json').read_text());manifest['variants']=[v for v in manifest['variants'] if v['name'] not in changed];manifest.setdefault('types',{})['0']=['cumulus-a.rg8','cumulus-b.rg8','cumulus-c.rg8'];manifest['bakeModel']='density + precomputed sun transmittance'
for _,(name,id,dims) in enumerate(configs):
 order={1:0,2:1,3:2,4:3,5:4,6:5,7:6,8:7,9:8}[id]
 bm.W,bm.H,bm.D=W,H,D=dims
 z,y,x=np.meshgrid(np.linspace(-1,1,D),np.linspace(-.65,.85,H),np.linspace(-1.15,1.15,W),indexing='ij');p=np.stack((x,y,z),axis=-1).astype(np.float32)
 n=bm.value_noise(p,3.2,500+id);fine=bm.value_noise(p,13.2,700+id)
 old=bpy.data.collections.get(name+' • prepared source')
 if old:
  for ob in list(old.objects):bpy.data.objects.remove(ob,do_unlink=True)
  bpy.data.collections.remove(old)
 collection=bpy.data.collections.new(name+' • prepared source');scene.collection.children.link(collection)
 control=bpy.data.objects.new(name+' controls',None);collection.objects.link(control);control.location=(order*4,0,0);control['cloud_type']=name;control['density_seed']=500+id;control['volume_bounds']='x:-1.15..1.15, y:-.65...85, z:-1..1';control['recipe']='bake_all_clouds.py'
 lobes=[];rng=np.random.default_rng(120+id)
 if id in [1,5,9]:
  count={1:12,5:30,9:76}[id];radius={1:.32,5:.15,9:.075}[id]
  for j in range(count):
   cx,cz=rng.uniform(-.86,.86),rng.uniform(-.75,.75);cy=rng.uniform(-.13,.10);r=radius*rng.uniform(.7,1.25)
   lobes.append((np.array([cx,cy,cz]),np.array([r,r*({1:1.8,5:2.3,9:2.3}[id]),r*.9])))
  sdf=np.full((D,H,W),-5.,np.float32)
  for c,r in lobes:sdf=np.maximum(sdf,(1-np.linalg.norm((p-c)/r,axis=-1))*min(r))
  density=bm.smooth(-.012,.032 if id==1 else .014,sdf+n*(.025 if id==1 else .006)+fine*.003)*(.65+.25*(n*.5+.5))
 elif id==3:
  lobes=[(np.array([-.12,-.30,.02]),np.array([.30,.25,.27])),(np.array([-.17,-.02,.02]),np.array([.22,.30,.22])),(np.array([-.10,.24,.02]),np.array([.25,.29,.24])),(np.array([-.32,.04,.04]),np.array([.16,.17,.17])),(np.array([.07,.26,.06]),np.array([.17,.20,.17])),(np.array([.12,.57,0]),np.array([.86,.065,.62])),(np.array([.49,.57,-.03]),np.array([.49,.055,.49]))]
  sdf=np.full((D,H,W),-5.,np.float32)
  for c,r in lobes:
   dist=(1-np.linalg.norm((p-c)/r,axis=-1))*min(r);k=.04;h=np.clip(.5+.5*(dist-sdf)/k,0,1);sdf=sdf*(1-h)+dist*h+k*h*(1-h)
  density=bm.smooth(-.016,.04,sdf+n*.065+fine*.015)*(.72+.2*(n*.5+.5));density*=bm.smooth(-.52,-.46,y)*(1-bm.smooth(.64,.69,y))
 elif id==7:
  density=np.zeros((D,H,W),np.float32)
  for j in range(8):
   z0=-.75+j*.20;curl=z0+.055*np.sin(x*3+j)+(.16+.06*np.sin(j))*bm.smooth(-.2,.7,x)**2
   width=.015+.012*(.5+.5*np.sin(x*3+j));taper=bm.smooth(-1.10+j*.035,-.65+j*.025,x)*bm.smooth(1.05-j*.045,.52-j*.025,x)
   # Long, asymmetric filaments; coherent hooks, not isolated grains.
   strand=np.exp(-((z-curl)/(width*(1+.3*n)))**2)*np.exp(-((y-.06*np.sin(x*2+j))/.055)**2)*taper
   density=np.maximum(density,strand*(.34+.16*(n*.5+.5)))
 else:
  radius=np.sqrt((x/1.1)**2+(z/.96)**2);edge=1-bm.smooth(.72,1.05,radius+n*.045)
  centre={2:-.13,4:.02,6:.04,8:.05}[id];thickness={2:.14,4:.40,6:.07,8:.045}[id]
  profile=np.exp(-((y-centre-n*.035)/thickness)**4)
  amplitude={2:.78,4:.95,6:.20,8:.065}[id]
  density=profile*edge*amplitude*(.84+.16*(n*.5+.5))
  lobes=[(np.array([0,centre,0]),np.array([1.05,thickness,.93]))]
 density*=bm.smooth(-1.15,-1.10,x)*(1-bm.smooth(1.10,1.15,x))*bm.smooth(-1.,-.95,z)*(1-bm.smooth(.95,1.,z))*bm.smooth(-.65,-.60,y)*(1-bm.smooth(.80,.85,y))
 density=np.clip(density,0,1).astype(np.float32)
 for j,(c,r) in enumerate(lobes):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=12,location=(c[0]+order*4,-c[2],c[1]));ob=bpy.context.object;ob.name=name+' shape %02d'%j;ob.scale=(r[0],r[2],r[1]);ob['cloud_shape']=True
  for col in list(ob.users_collection):col.objects.unlink(ob)
  collection.objects.link(ob);ob.data.materials.append(mat)
  for poly in ob.data.polygons:poly.use_smooth=True
 if id==7:
  for j in range(8):
   curve=bpy.data.curves.new('Cirrus hook %02d'%j,'CURVE');curve.dimensions='3D';curve.bevel_depth=.012;curve.bevel_resolution=3;sp=curve.splines.new('POLY');sp.points.add(39)
   for k,point in enumerate(sp.points):
    xx=-1.05+k*2.1/39;zz=-.75+j*.2+.04*math.sin(xx*3+j)+.2*float(bm.smooth(-.1,.8,np.array(xx)))**2;point.co=(xx+order*4,-zz,.06*math.sin(xx*2+j),1)
   ob=bpy.data.objects.new('Cirrus filament %02d'%j,curve);collection.objects.link(ob)
 sun=np.array([.65,.72,.24]);sun/=np.linalg.norm(sun);tau=np.zeros_like(density)
 if id not in [7,8]:
  for j in range(1,18):tau+=bm.trilinear(density,p+sun*.075*(j-.5))*.075*9
 sunlight=np.exp(-tau);packed=np.stack((np.round(density*255),np.round(sunlight*255)),axis=-1).astype(np.uint8);data=packed.tobytes();filename=name+'.rg8';(root/'assets'/filename).write_bytes(data);compressed=gzip.compress(data,compresslevel=9);(root/'assets'/(filename+'.gz')).write_bytes(compressed)
 manifest['variants'].append({'name':filename,'width':W,'height':H,'depth':D,'bytes':len(data),'compressedBytes':len(compressed),'gzip':filename+'.gz','type':id})
 manifest['types'][str(id)]=[filename];print('BAKED',name,len(compressed),'bytes compressed',flush=True)
(root/'assets/manifest.json').write_text(json.dumps(manifest,indent=2))
scene['readme']='Prepared cloud source guides. Editable cumulus shapes are retained in Cumulus Study. Sheet and filament recipes, density seeds, optical-depth bake and bounds live in bake_all_clouds.py. Runtime sky layouts are separate from these normalized source guides.'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'cloud-atlas-study.blend'))
print('ALL_TYPES_BAKED',len(manifest['types']),flush=True)
