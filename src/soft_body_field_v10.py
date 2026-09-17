"""One smoothly blended plush silhouette, following the user's v10 sheet.

Run with qa/.venv_sculpt/bin/python (numpy + scikit-image). Blender imports the
result, creates the final mesh and handles all skinning, materials and renders.
"""
import numpy as np
from skimage.measure import marching_cubes
from pathlib import Path
R=Path(__file__).resolve().parents[1]
step=.011
lo=np.array([-.60,-.90,-.04],dtype=np.float32)
hi=np.array([.60,.88,1.30],dtype=np.float32)
axes=[np.arange(lo[i],hi[i]+step,step,dtype=np.float32) for i in range(3)]
P=np.stack(np.meshgrid(*axes,indexing='ij'),axis=-1)
field=np.full(P.shape[:-1],10,dtype=np.float32)
def union(d,k):
 global field
 h=np.maximum(k-np.abs(field-d),0)/k
 field=np.minimum(field,d)-h*h*k*.25
def ell(c,r,k=.14):
 p=P-np.array(c);r=np.array(r);k0=np.linalg.norm(p/r,axis=-1);k1=np.linalg.norm(p/(r*r),axis=-1)
 d=k0*(k0-1)/np.maximum(k1,1e-5)
 union(d,k)
def capsule(a,b,ra,rb,k=.13):
 a=np.array(a);b=np.array(b);ab=b-a;p=P-a;t=np.clip(np.sum(p*ab,axis=-1)/np.sum(ab*ab),0,1)
 d=np.linalg.norm(p-t[...,None]*ab,axis=-1)-(ra+(rb-ra)*t)
 union(d,k)
# Single bean-shaped torso; no isolated scapula or glute spheres.
ell((0,.075,.675),(.315,.635,.305),.18)
ell((0,-.37,.70),(.28,.265,.30),.20)
ell((0,-.49,.84),(.245,.205,.30),.20)
for sign in [-1,1]:
 x=sign*.235
 # Short, padded forelegs; elbow hidden in the soft body envelope.
 capsule((x,-.40,.67),(x,-.38,.36),.135,.112,.19)
 capsule((x,-.38,.38),(x,-.455,.135),.113,.096,.12)
 ell((x,-.500,.086),(.126,.135,.084),.08)
 # Rear leg has correct bend directions without exposed muscle globes.
 capsule((x,.43,.68),(x,.26,.385),.145,.123,.19)
 capsule((x,.26,.39),(x,.46,.185),.116,.104,.12)
 capsule((x,.46,.185),(x,.405,.095),.097,.089,.09)
 ell((x,.355,.083),(.128,.138,.081),.07)
 for dx in [-.066,0,.066]:
  ell((x+dx,-.593,.073),(.048,.052,.065),.018)
  ell((x+dx,.250,.071),(.048,.052,.064),.018)
field=np.maximum(field,.006-P[...,2])
vertices,faces,_,_=marching_cubes(field.astype(np.float32),0,spacing=(step,step,step),allow_degenerate=False)
vertices+=lo
np.savez_compressed(R/'qa/soft_body_v10.npz',vertices=vertices,faces=faces)
print('SOFT_BODY_FIELD',len(vertices),len(faces),flush=True)
