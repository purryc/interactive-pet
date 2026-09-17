"""Rebuild quadruped torso and limbs; retain original textured head and tail."""
import bpy, bmesh, math, json, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'output/siamese_cat_quadruped_v6.blend'))
s=bpy.context.scene; rig=bpy.data.objects['Cat_Rig']; old=bpy.data.objects['Cat_Mesh']
rig.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
for b in rig.pose.bones:b.matrix_basis.identity()
for m in list(old.modifiers):old.modifiers.remove(m)
s.frame_set(1);s.timeline_markers.clear()
# Keep only the original head and tail, with their UV coordinates intact.
keep=[]
for v in old.data.vertices:
 weights={old.vertex_groups[g.group].name:g.weight for g in v.groups}
 h=sum(w for n,w in weights.items() if n in ['head','jaw','ear.L','ear.R','eye.L','eye.R'])
 t=sum(w for n,w in weights.items() if n.startswith('tail_'))
 if h>.60 or t>.60:
  keep.append(v.index)
  if t>.60:v.co+=Vector((0,-.05,-.18))
bm=bmesh.new();bm.from_mesh(old.data);bm.verts.ensure_lookup_table();ks=set(keep)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in ks],context='VERTS');bm.to_mesh(old.data);bm.free()
for v in old.data.vertices:
 weights={old.vertex_groups[g.group].name:g.weight for g in v.groups}
 allowed={n:w for n,w in weights.items() if n.startswith('tail_') or n in ['head','jaw','ear.L','ear.R','eye.L','eye.R']}
 for gi in [g.group for g in v.groups]:old.vertex_groups[gi].remove([v.index])
 total=sum(allowed.values())
 for n,w in allowed.items():old.vertex_groups[n].add([v.index],w/total,'REPLACE')
old.name='Preserved_head_tail'

# Define the actual feline chain: hip -> forward stifle -> rear hock -> toes.
spec={}
def put(n,h,t):spec[n]=(Vector(h),Vector(t))
put('pelvis',(0,.43,.68),(0,.20,.73));put('spine',(0,.20,.73),(0,-.10,.76));put('chest',(0,-.10,.76),(0,-.42,.79))
put('neck',(0,-.42,.79),(0,-.64,.84))
for side,sign in [('L',1),('R',-1)]:
 x=sign*.235
 put('clavicle.'+side,(x,-.18,.81),(x,-.40,.67))
 put('front_upper.'+side,(x,-.40,.67),(x,-.38,.36))
 put('front_lower.'+side,(x,-.38,.36),(x,-.455,.135))
 put('front_paw.'+side,(x,-.455,.135),(x,-.61,.075))
 put('hind_upper.'+side,(x,.43,.68),(x,.26,.385))
 put('hind_lower.'+side,(x,.26,.385),(x,.46,.185))
 put('hind_ankle.'+side,(x,.46,.185),(x,.405,.095))
 put('hind_paw.'+side,(x,.405,.095),(x,.255,.07))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:b.use_connect=False
for b in rig.data.edit_bones:
 if b.name.startswith('tail_'):b.head+=Vector((0,-.05,-.18));b.tail+=Vector((0,-.05,-.18))
for n,(h,t) in spec.items():
 b=rig.data.edit_bones.get(n) or rig.data.edit_bones.new(n);b.head=h;b.tail=t
for side in ['L','R']:
 rig.data.edit_bones['hind_ankle.'+side].parent=rig.data.edit_bones['hind_lower.'+side]
 rig.data.edit_bones['hind_paw.'+side].parent=rig.data.edit_bones['hind_ankle.'+side]
bpy.ops.object.mode_set(mode='OBJECT')
for b in rig.pose.bones:b.matrix_basis.identity()

# Import a smoothly blended implicit surface rather than overlapping muscle balls.
field=np.load(R/'qa/soft_body_v10.npz')
me=bpy.data.meshes.new('Soft continuous body');me.from_pydata(field['vertices'].tolist(),[],field['faces'].tolist());me.update()
body=bpy.data.objects.new('Rebuilt_soft_body',me);s.collection.objects.link(body)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
sm=body.modifiers.new('Soft surface finish','SMOOTH');sm.factor=.65;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
dec=body.modifiers.new('Surface budget','DECIMATE');dec.ratio=.65;bpy.ops.object.modifier_apply(modifier=dec.name)
for p in body.data.polygons:p.use_smooth=True

# Point coloration is stored on vertices, compatible with glTF and Blender.
mat=bpy.data.materials.new('Siamese continuous coat');mat.use_nodes=True
nodes=mat.node_tree.nodes;bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.86
attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Coat';mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
body.data.materials.append(mat)
colors=body.data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for v in body.data.vertices:
 p=v.co;point=1-smooth(.17,.34,p.z)
 cream=Vector((.83,.69,.51));brown=Vector((.13,.058,.029));c=cream.lerp(brown,point)
 # Soft ivory chest/belly, without a hard shoulder or hip patch.
 ivory=(1-point)*.17*math.exp(-((p.y+.38)/.35)**2);c=c.lerp(Vector((.98,.91,.78)),ivory)
 colors.data[v.index].color=(*c,1)

# Smooth anatomical weights. Each limb blends into the thorax/haunch and has
# separate knee, hock and paw influences rather than a humanoid foot chain.
for b in rig.data.bones:body.vertex_groups.new(name=b.name)
def weights(p):
 x,y,z=p;side='L' if x>=0 else 'R'
 kind='front' if y<-.04 else 'hind'
 # Paw and cuff share continuous weights across their full cross-section.
 # Centerline locking is restricted to the belly, never the inner lower leg.
 limb_y=(1-smooth(-.34,-.12,y)) if kind=='front' else smooth(.07,.32,y)
 blend=max(smooth(.48,.81,z),(1-limb_y)*smooth(.18,.34,z),(1-smooth(.025,.13,abs(x)))*smooth(.18,.31,z))
 if kind=='front':
  paw=1-smooth(.17,.27,z);upper=smooth(.28,.45,z)
  scores={'front_paw.'+side:paw,'front_lower.'+side:(1-paw)*(1-upper),'front_upper.'+side:(1-paw)*upper}
 else:
  paw=1-smooth(.14,.22,z);ankle=1-smooth(.20,.29,z);upper=smooth(.31,.49,z)
  scores={'hind_paw.'+side:paw,'hind_ankle.'+side:(1-paw)*ankle,'hind_lower.'+side:(1-paw)*(1-ankle)*(1-upper),'hind_upper.'+side:(1-paw)*(1-ankle)*upper}
 out={n:w*(1-blend) for n,w in scores.items()}
 torso={'pelvis':math.exp(-((y-.43)/.25)**2),'spine':math.exp(-((y-.08)/.27)**2),'chest':math.exp(-((y+.37)/.26)**2),'neck':math.exp(-((y+.60)/.20)**2)*smooth(.70,.98,z)}
 tot=sum(torso.values())
 for n,w in torso.items():out[n]=w/tot*blend
 top=sorted(out.items(),key=lambda i:-i[1])[:4];tot=sum(w for n,w in top)
 return [(n,w/tot) for n,w in top if w>1e-7]
for v in body.data.vertices:
 for n,w in weights(v.co):body.vertex_groups[n].add([v.index],w,'REPLACE')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);old.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
body.name='Cat_Mesh';body.parent=rig
cap=bpy.data.materials.new('Neck interface cream');cap.use_nodes=True;cap.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.83,.69,.51,1);cap.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
body.data.materials.append(cap)
bm=bmesh.new();bm.from_mesh(body.data);result=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
for face in result['faces']:face.material_index=len(body.data.materials)-1;face.smooth=True
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
body.data.uv_layers.active_index=0;body.data.uv_layers[0].active_render=True
arm=body.modifiers.new('Cat skin','ARMATURE');arm.object=rig;arm.use_deform_preserve_volume=False
rig['revision']='v10: plush continuous torso, short padded limbs, concealed joint anatomy, following the new quadruped user sheet.'
rig['geometry_note']='Head and tail retain original UVs. Body is a single smooth implicit surface, with no exposed muscle spheres. Head/tail cut boundaries are closed in the final build.'
s.frame_start=s.frame_end=1;s.camera.data.ortho_scale=3.35;s.render.resolution_x=s.render.resolution_y=800;s.render.resolution_percentage=100;s.cycles.samples=16
bpy.ops.wm.save_as_mainfile(filepath=str(R/'qa/quadruped_base_v10.blend'),compress=True)
for name,loc in [('side',(5,0,1.2)),('hero',(3.8,-4.4,2.45)),('front',(0,-5,1.2)),('back',(0,5,1.2))]:
 s.camera.location=loc;s.camera.rotation_euler=(Vector((0,0,1.04))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(R/'qa'/f'quad_v10_anatomy_{name}.png');bpy.ops.render.render(write_still=True)
print('V10_REBUILD_DONE',len(body.data.vertices))
