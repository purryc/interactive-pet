import bpy,json,os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.data.objects if o.type=='MESH');s=bpy.context.scene;s.render.fps=24
report={'armature':rig.name,'bones':len(rig.data.bones),'clips':{},'errors':[]}
for tr in rig.animation_data.nla_tracks:tr.mute=True
actions={a.name:a for a in bpy.data.actions}
clip_names=json.loads((R/f'output/cat_asset_config_{VERSION}.json').read_text())['clipNames']
for n in clip_names:
 a=next((a for an,a in actions.items() if an==n or an.startswith(n)),None)
 if not a:report['errors'].append('Missing clip '+n);continue
 rig.animation_data.action=a
 report['clips'][n]={'frames':list(a.frame_range),'samples':[]}
 for f in [a.frame_range[0],(a.frame_range[0]+a.frame_range[1])/2,a.frame_range[1]]:
  s.frame_set(int(f));ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();pts=[ev.matrix_world@v.co for v in me.vertices];lo=[min(v[i] for v in pts) for i in range(3)];hi=[max(v[i] for v in pts) for i in range(3)];ev.to_mesh_clear()
  report['clips'][n]['samples'].append({'frame':f,'min':lo,'max':hi})
  if lo[2]<-.015:report['errors'].append(n+' below floor')
  if max(hi[i]-lo[i] for i in range(3))>1.5:report['errors'].append(n+' invalid scale')
with bpy.data.libraries.load(str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'),link=False) as (src,dst):dst.objects=[n for n in ['Camera','Key','Fill','Rim','Studio_Ground'] if n in src.objects]
for o in dst.objects:
 s.collection.objects.link(o)
 if o.type in ['CAMERA','LIGHT']:o.location*=.25
 if o.type=='LIGHT':o.data.energy*=.25**2
 if o.type=='CAMERA':s.camera=o;o.data.ortho_scale*=.25
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.40,.5,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.use_persistent_data=True;s.render.resolution_x=s.render.resolution_y=720;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
for name,frame in [('CAT_IDLE',1),('CAT_WALK',11),('CAT_CROUCH',25),('CAT_PAW_L',21),('CAT_JUMP',17),('CAT_SIT',31)]:
 rig.animation_data.action=actions[name];s.frame_set(frame);s.render.filepath=str(R/'qa'/f'glb_{VERSION}_{name.lower()}.png');bpy.ops.render.render(write_still=True)
report['status']='pass' if not report['errors'] else 'revise'
(R/f'qa/glb_reimport_{VERSION}.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(R/f'qa/glb_reimport_{VERSION}.blend'),compress=True)
