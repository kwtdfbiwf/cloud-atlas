import json,struct,math
from pathlib import Path
p=Path(__file__).parent/'reference-clouds.glb';b=p.read_bytes()
assert b[:4]==b'glTF';n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
expected={'Cu_0','Cu_1','Cu_2','Sc','St','Cb','Ns','Ac','As','Ci','Cs','Cc'}
assert expected=={node['name'] for node in j['nodes']}
triangles=0
for mesh in j['meshes']:
 for prim in mesh['primitives']:
  assert {'POSITION','NORMAL','COLOR_0'}<=set(prim['attributes'])
  a=j['accessors'][prim['attributes']['POSITION']]
  assert all(math.isfinite(x) for x in a['min']+a['max'])
  assert all(a['max'][i]>a['min'][i] for i in range(3))
  triangles+=j['accessors'][prim['indices']]['count']//3
print(f'PASS: 10 cloud types, 12 prototypes, vertex colours, normals and bounds; {triangles:,} unique triangles; {len(b)/1e6:.2f} MB.')
