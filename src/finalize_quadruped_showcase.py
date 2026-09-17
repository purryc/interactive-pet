"""Arrange matched jump stages consecutively and render final orthographic views."""
import bpy, sys, json, os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'src'));VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
from quadruped_animation import CLIPS
bpy.ops.wm.open_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'))
s=bpy.context.scene;rig=bpy.data.objects['Cat_Rig']
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
rig.animation_data.action=None
tr=rig.animation_data.nla_tracks.new();tr.name='Quadruped showcase'
s.timeline_markers.clear();segments=[];start=1
for name,length,loop in CLIPS:
 repeat=2 if name in ['CAT_WALK','CAT_RUN'] else 1
 seg={'name':name,'start':start,'end':start+length*repeat-1,'length':length,'repeat':repeat,'loop':loop};segments.append(seg)
 strip=tr.strips.new(name,start,bpy.data.actions[name]);strip.action_frame_start=1;strip.action_frame_end=length+1;strip.repeat=repeat;strip.frame_end=seg['end']+1;strip.extrapolation='NOTHING'
 s.timeline_markers.new(name,frame=start);start=seg['end']+1
(R/f'qa/quadruped_segments_{VERSION}.json').write_text(json.dumps(segments,indent=2))
s.frame_set(1);s.frame_start=1;s.frame_end=start-1
s.camera.data.ortho_scale=3.2;s.camera.location=(3.8,-4.4,2.45);s.camera.rotation_euler=(Vector((0,0,1.02))-s.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'),compress=True)
s.render.resolution_x=s.render.resolution_y=800;s.render.resolution_percentage=100;s.cycles.samples=24;s.render.use_persistent_data=True
for name,location in [('hero',(3.8,-4.4,2.45)),('front',(0,-5,1.1)),('side',(5,0,1.1)),('back',(0,5,1.1))]:
 s.camera.location=location;s.camera.rotation_euler=(Vector((0,0,1.02))-s.camera.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(R/'output'/f'siamese_cat_quadruped_{name}_{VERSION}.png');bpy.ops.render.render(write_still=True)
print('FINAL_SHOWCASE_READY')
