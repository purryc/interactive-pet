import bpy,sys,json,os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
bpy.ops.wm.open_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'))
s=bpy.context.scene;s.cycles.samples=8;s.cycles.use_denoising=True;s.render.use_persistent_data=True;s.render.resolution_x=s.render.resolution_y=640;s.render.resolution_percentage=100
if os.environ.get('CAT_RENDER_RES'):s.render.resolution_x=s.render.resolution_y=int(os.environ['CAT_RENDER_RES'])
if os.environ.get('CAT_RENDER_SAMPLES'):s.cycles.samples=int(os.environ['CAT_RENDER_SAMPLES'])
if os.environ.get('CAT_RENDER_ENGINE')=='EEVEE':s.render.engine='BLENDER_EEVEE';s.render.image_settings.file_format='PNG'
s.camera.data.ortho_scale=3.5;s.camera.location=(3.8,-4.4,2.45);s.camera.rotation_euler=(Vector((0,0,1.05))-s.camera.location).to_track_quat('-Z','Y').to_euler()
folder=R/os.environ.get('CAT_FRAME_DIR',f'qa/quadruped_frames_{VERSION}');folder.mkdir(exist_ok=True,parents=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
start,end=(int(args[0]),int(args[1])) if len(args)==2 else (1,s.frame_end)
for f in range(start,end+1):
 p=folder/f'frame_{f:04d}.png'
 if p.exists():continue
 if 73<=f<=200:
  s.camera.location=(4.5,-1.1,1.9)
 else:s.camera.location=(3.8,-4.4,2.45)
 s.camera.rotation_euler=(Vector((0,0,1.05))-s.camera.location).to_track_quat('-Z','Y').to_euler()
 s.frame_set(f);s.render.filepath=str(p);bpy.ops.render.render(write_still=True)
print('RENDER_DONE',start,end)
