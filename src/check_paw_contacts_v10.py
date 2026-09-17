"""All supporting paws, every baked frame; measure actual skinned vertices."""
import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'output/siamese_cat_quadruped_v10.blend'))
rig=bpy.data.objects['Cat_Rig'];mesh=bpy.data.objects['Cat_Mesh'];scene=bpy.context.scene
for track in rig.animation_data.nla_tracks:track.mute=True
motion=json.loads((R/'qa/quadruped_motion_v10.json').read_text())
names=[f'{kind}_paw.{side}' for kind in ('front','hind') for side in ('L','R')]
indices={n:[v.index for v in mesh.data.vertices if any(g.group==mesh.vertex_groups[n].index and g.weight>.7 for g in v.groups)] for n in names}
report={}
for clip,description in motion.items():
 rig.animation_data.action=bpy.data.actions[clip];frames=description['frames'];errors=[];samples=[]
 for i in range(len(frames)):
  scene.frame_set(i+1);ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh()
  for n in names:
   if not frames[i]['contacts'][n]:continue
   z=min((ev.matrix_world@m.vertices[v].co).z for v in indices[n]);samples.append(z)
   if z>.025 or z<-.02:errors.append([i+1,n,round(z,4)])
  ev.to_mesh_clear()
 report[clip]={'sampledSupportingPaws':len(samples),'contactZRange':[min(samples),max(samples)],'badContacts':errors[:20],'badContactCount':len(errors)}
(R/'qa/paw_contacts_v10.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if any(v['badContactCount'] for v in report.values()):raise RuntimeError('Paw contact mismatch')
