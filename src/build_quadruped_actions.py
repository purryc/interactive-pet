import bpy,sys,json,os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'src'));VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
from quadruped_animation import CLIPS,pose
bpy.ops.wm.open_mainfile(filepath=str(R/f'qa/quadruped_base_{"v5" if VERSION=="v6" else VERSION}.blend'))
s=bpy.context.scene;rig=bpy.data.objects['Cat_Rig'];body=bpy.data.objects['Cat_Mesh']
cam=s.camera;cam.location=(3.8,-4.4,2.45);cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler()
for m in body.modifiers:
 if m.type=='SUBSURF':m.show_viewport=False
 if m.type=='ARMATURE':m.use_deform_preserve_volume=False
paw_offsets={}
for kind in ['front','hind']:
 for side in ['L','R']:
  n=f'{kind}_paw.{side}';g=body.vertex_groups[n].index
  vertices=[v.co.z for v in body.data.vertices if any(x.group==g and x.weight>.65 for x in v.groups)]
  paw_offsets[n]=-min(vertices)+.003
rig.animation_data_create();reports={};segments=[];start=1
for name,length,loop in CLIPS:
 a=bpy.data.actions.new(name);a.use_fake_user=True;a.asset_mark();a.asset_data.description='Quadruped Siamese / '+name;rig.animation_data.action=a;frames=[]
 for f in range(1,length+2):
  frames.append(pose(rig,name,(f-1)/length,paw_offsets))
  for b in rig.pose.bones:
   b.keyframe_insert(data_path='location',frame=f,group=b.name);b.keyframe_insert(data_path='rotation_quaternion',frame=f,group=b.name)
 for layer in a.layers:
  for strip in layer.strips:
   bag=strip.channelbag(a.slots[0])
   for fc in bag.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'
 reports[name]={'duration':length/24,'loop':loop,'max_ik_error':max(x['max_ik_error'] for x in frames),'frames':frames}
 repeat=2 if name in ['CAT_WALK','CAT_RUN'] else 1
 segments.append({'name':name,'start':start,'end':start+length*repeat-1,'length':length,'repeat':repeat,'loop':loop});start+=length*repeat
 print('BUILT',name,reports[name]['max_ik_error'],flush=True)
rig.animation_data.action=None;tr=rig.animation_data.nla_tracks.new();tr.name='Quadruped showcase';s.timeline_markers.clear()
for seg in segments:
 strip=tr.strips.new(seg['name'],seg['start'],bpy.data.actions[seg['name']]);strip.action_frame_start=1;strip.action_frame_end=seg['length']+1;strip.repeat=seg['repeat'];strip.frame_end=seg['end']+1;strip.extrapolation='NOTHING';s.timeline_markers.new(seg['name'],frame=seg['start'])
for m in body.modifiers:
 if m.type=='SUBSURF':m.show_viewport=True
s.frame_start=1;s.frame_end=start-1;s.render.fps=24;s.frame_set(1)
rig['animation_note']='All four legs support neutral idle. Baked contact-path FK keys. Walk/Run in-place. Crouch -> Jump -> Land separate matched stages. Eye/jaw bones reserved, not animated.'
rig['paw_offsets_json']=json.dumps(paw_offsets)
(R/f'qa/quadruped_motion_{VERSION}.json').write_text(json.dumps(reports,indent=2))
(R/f'qa/quadruped_segments_{VERSION}.json').write_text(json.dumps(segments,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'),compress=True)
s.render.resolution_x=s.render.resolution_y=720;s.cycles.samples=16;s.render.use_persistent_data=True
for seg in segments:
 sample=seg['start']+int(seg['length']*(.98 if seg['name']=='CAT_CROUCH' else .25 if seg['name'] in ['CAT_WALK','CAT_RUN'] else .5));s.frame_set(sample)
 s.render.filepath=str(R/'qa'/f"quad_{VERSION}_{seg['name'].lower()}.png");bpy.ops.render.render(write_still=True)
print('QUAD_ACTIONS_DONE',s.frame_end)
