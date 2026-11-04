import numpy as np
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
