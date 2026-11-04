"""Run inside the edited cumulus-study.blend with Blender --background --python."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent
scene=bpy.data.scenes['Cloud field composition'];rows=[]
for ob in sorted((o for o in scene.objects if o.get('cloud_placement')),key=lambda o:o.name):
 x,y,z=ob.location; sx,sy,sz=ob.scale
 rows.append([x,z,-y,sx*2.3,sz*1.5,sy*2,int(ob['cloud_variant']),ob.rotation_euler.z])
(root/'layout.json').write_text(json.dumps({'version':1,'clouds':rows},indent=2))
print('EXPORTED',len(rows),'cloud placements to',root/'layout.json')
