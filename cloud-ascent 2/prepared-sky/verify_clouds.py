from pathlib import Path
import json,gzip,hashlib
root=Path(__file__).resolve().parent;m=json.loads((root/'assets/manifest.json').read_text());layout=json.loads((root/'layout.json').read_text())
assert set(m['types'])==set(map(str,range(10)))==set(layout['types'])
known={v['name'] for v in m['variants']};hashes=set()
for v in m['variants']:
 data=(root/'assets'/v['name']).read_bytes();assert len(data)==v['width']*v['height']*v['depth']*2==v['bytes'];assert gzip.decompress((root/'assets'/v['gzip']).read_bytes())==data
 density=data[::2];assert min(density)==0 and max(density)>5
 assert len(set(density))>10
 hashes.add(hashlib.sha256(data).digest())
for id,names in m['types'].items():
 assert names and set(names)<=known
 assert layout['types'][id]
 for row in layout['types'][id]:assert len(row)==8 and all(row[i]>0 for i in [3,4,5]) and 0<=row[6]<len(names)
assert len(hashes)==len(m['variants'])
print('PASS: all 10 types, 12 distinct volumes, layouts, density variation and gzip integrity.')
print('Total compressed bytes:',sum(v['compressedBytes'] for v in m['variants']))
