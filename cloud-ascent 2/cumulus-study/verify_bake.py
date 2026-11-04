from pathlib import Path
import json,gzip,hashlib
root=Path(__file__).resolve().parent
manifest=json.loads((root/'assets/manifest.json').read_text());hashes=set()
for variant in manifest['variants']:
 data=(root/'assets'/variant['name']).read_bytes();w,h,d=[variant[k] for k in ['width','height','depth']]
 assert len(data)==w*h*d*2==variant['bytes']
 assert gzip.decompress((root/'assets'/variant['gzip']).read_bytes())==data
 density=data[::2];sun=data[1::2];assert max(density)>180 and min(density)==0
 assert len(set(density))>150 and min(sun)<50 and max(sun)==255
 occupied=sum(v>2 for v in density);assert .02<len([v for v in density if v>2])/len(density)<.35
 for z in range(d):
  for y in range(h):
   for x in [0,w-1]:assert data[((z*h+y)*w+x)*2]==0
 for y in [0,h-1]:
  for z in range(d):assert not any(data[((z*h+y)*w)*2:((z*h+y+1)*w)*2:2])
 for z in [0,d-1]:assert not any(data[z*w*h*2:(z+1)*w*h*2:2])
 hashes.add(hashlib.sha256(data).hexdigest())
 print(variant['name'],'valid density, sunlight, empty boundaries and lossless compression')
assert len(hashes)==3
print('PASS: 3 distinct prepared volumes; total compressed transfer',sum(v['compressedBytes'] for v in manifest['variants']),'bytes')
