import bpy,json,sys,math,os
from pathlib import Path
R=Path(__file__).resolve().parents[1];VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
bpy.ops.wm.open_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'))
rig=bpy.data.objects['Cat_Rig'];body=bpy.data.objects['Cat_Mesh'];s=bpy.context.scene
segments=json.loads((R/f'qa/quadruped_segments_{VERSION}.json').read_text());report={'errors':[],'clips':{},'bones':len(rig.data.bones),'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons)}
for tr in rig.animation_data.nla_tracks:tr.mute=True
for m in body.modifiers:
 if m.type=='SUBSURF':m.show_viewport=False
report['maxInfluences']=max(len(v.groups) for v in body.data.vertices)
report['weightErrors']=sum(abs(sum(g.weight for g in v.groups)-1)>1e-5 for v in body.data.vertices)
if report['weightErrors']:report['errors'].append('invalid weight sums')
if report['maxInfluences']>4:report['errors'].append('more than 4 influences')
report['texturesPacked']=all(im.packed_file for im in bpy.data.images if im.source=='FILE')
if not report['texturesPacked']:report['errors'].append('unpacked texture')
ends={}
for seg in segments:
 name=seg['name'];a=bpy.data.actions[name];rig.animation_data.action=a;low=1e9;high=-1e9;deltas=[]
 for f in range(1,seg['length']+2):
  s.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(dg);me=ev.to_mesh()
  coords=[ev.matrix_world@v.co for v in me.vertices];lo=min(v.z for v in coords);hi=max(v.z for v in coords);low=min(low,lo);high=max(high,hi)
  if not all(math.isfinite(c) for v in coords for c in v):report['errors'].append(name+' nonfinite mesh')
  ev.to_mesh_clear()
  if f in [1,seg['length']+1]:ends[(name,'start' if f==1 else 'end')]={b.name:b.matrix.copy() for b in rig.pose.bones}
 for layer in a.layers:
  for strip in layer.strips:
   bag=strip.channelbag(a.slots[0])
   for fc in bag.fcurves:deltas.append(abs(fc.evaluate(1)-fc.evaluate(seg['length']+1)))
 loop_error=max(deltas)
 if seg['loop'] and loop_error>1e-5:report['errors'].append(name+' open loop')
 if low<-.035:report['errors'].append(name+' mesh penetrates ground '+str(low))
 report['clips'][name]={'seconds':seg['length']/24,'loop':seg['loop'],'loopEndpointError':loop_error,'minZ':low,'maxZ':high}
report['boundaries']={}
for left,right in [('CAT_CROUCH','CAT_JUMP'),('CAT_JUMP','CAT_LAND'),('CAT_LAND','CAT_IDLE')]:
 error=max(abs(ends[(left,'end')][n][i][j]-ends[(right,'start')][n][i][j]) for n in rig.pose.bones.keys() for i in range(4) for j in range(4))
 report['boundaries'][left+' -> '+right]=error
 if error>1e-4:report['errors'].append(left+' -> '+right+' unmatched pose')
report['status']='pass' if not report['errors'] else 'revise'
(R/f'qa/quadruped_validation_{VERSION}.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if report['errors']:raise RuntimeError(report['errors'])
