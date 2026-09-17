import bpy,json,struct,os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
bpy.ops.wm.open_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'))
rig=bpy.data.objects['Cat_Rig'];body=bpy.data.objects['Cat_Mesh']
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis.identity()
# Match the standard four-influence skin shader used by Three.js.
trimmed=0
for v in body.data.vertices:
 pairs=sorted([(g.group,g.weight) for g in v.groups if g.weight>0],key=lambda x:-x[1])
 if len(pairs)>4:
  trimmed+=1
  for i,w in pairs[4:]:body.vertex_groups[i].remove([v.index])
  total=sum(w for i,w in pairs[:4])
  for i,w in pairs[:4]:body.vertex_groups[i].add([v.index],w/total,'REPLACE')
for m in body.modifiers:
 if m.type=='ARMATURE':m.use_deform_preserve_volume=False
# Save the same skinning and weight representation in the editable source.
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.context.scene.frame_set(1)
rig['runtime_skinning']='Linear blend skinning, at most 4 weights per vertex. Matches standard glTF/Three.js.'
bpy.ops.wm.save_as_mainfile(filepath=str(R/f'output/siamese_cat_quadruped_{VERSION}.blend'),compress=True)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.scale=(.25,.25,.25)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
for m in body.modifiers:
 if m.type=='SUBSURF':m.show_viewport=False;m.show_render=False
path=R/f'output/siamese_cat_quadruped_{VERSION}.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_force_sampling=True,export_frame_range=False,export_anim_slide_to_zero=True,export_skins=True,export_influence_nb=4,export_all_influences=False,export_apply=False,export_def_bones=False,export_rest_position_armature=True,export_extras=True,export_cameras=False,export_lights=False)
raw=path.read_bytes();size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size])
names=[a.get('name') for a in doc.get('animations',[])];assert len(names)==(12 if VERSION in ['v9','v10'] else 11),names
config={
 'modelUrl':f'./siamese_cat_quadruped_{VERSION}.glb','scale':1,'rotationOffset':[0,0,0],
 'coordinateSystem':{'up':[0,1,0],'forward':[0,0,1],'unit':'meter','blenderWorkingToMeters':.25},
 'boneMap':{'root':'root','pelvis':'pelvis','spine01':'spine','spine02':'chest','neck':'neck','head':'head','frontLegL':'front_upper.L','frontLegR':'front_upper.R','frontLowerL':'front_lower.L','frontLowerR':'front_lower.R','frontPawL':'front_paw.L','frontPawR':'front_paw.R','backLegL':'hind_upper.L','backLegR':'hind_upper.R','backLowerL':'hind_lower.L','backLowerR':'hind_lower.R','backPawL':'hind_paw.L','backPawR':'hind_paw.R','tail01':'tail_01','tail02':'tail_02','tail03':'tail_03','tail04':'tail_04','tail05':'tail_05','earL':'ear.L','earR':'ear.R','eyeL':None,'eyeR':None,'jaw':None},
 'reservedGuideBones':{'eyeL':'eye.L','eyeR':'eye.R','jaw':'jaw'},
 'animationMap':{'idle':'CAT_IDLE','walk':'CAT_WALK','run':'CAT_RUN','crouch':'CAT_CROUCH','pawLeft':'CAT_PAW_L','pawRight':'CAT_PAW_R','jump':'CAT_JUMP','land':'CAT_LAND','sit':'CAT_SIT','lookAround':'CAT_LOOK_AROUND','sniff':'CAT_SNIFF'},
 'loop':['idle','walk','run','sit','lookAround'],'oneShot':['crouch','pawLeft','pawRight','jump','land','sniff'],
 'transitions':{'crouch':{'next':'jump','clampWhenFinished':True},'jump':{'next':'land','clampWhenFinished':True},'land':{'next':'idle'},'pawLeft':{'next':'idle'},'pawRight':{'next':'idle'},'sniff':{'next':'idle'}},
 'locomotion':{'inPlace':True,'walkSpeedMetersPerSecond':.22/(.76*(40/24))*.25,'runSpeedMetersPerSecond':.30/(.53*(24/24))*.25,'rootMotionXZ':False},
 'look':{'neckWeight':.4,'headWeight':.6,'headYawDegrees':55,'neckYawDegrees':25,'pitchUpDegrees':35,'pitchDownDegrees':25,'note':'Apply after AnimationMixer update relative to current animation pose. Eyes are texture, not independent gaze.'},
 'capabilities':{'quadruped':True,'headNeckTrackingBones':True,'independentEyes':False,'mouthAnimation':False,'blinkMorph':False,'runtimeIKRequired':False,'furSimulation':False},
 'skin':{'maxInfluences':4,'trimmedVertexCount':trimmed},
 'clipNames':names}
if VERSION in ['v9','v10']:
 config['boneMap'].update({'backAnkleL':'hind_ankle.L','backAnkleR':'hind_ankle.R'})
 config['animationMap']['stretch']='CAT_STRETCH';config['oneShot'].append('stretch');config['transitions']['stretch']={'next':'idle'}
for n in ['neck','head']:
 b=rig.data.bones[n];config['look'][n+'ForwardLocal']=list(b.matrix_local.to_quaternion().inverted()@Vector((0,-1,0)))
(R/f'output/cat_asset_config_{VERSION}.json').write_text(json.dumps(config,ensure_ascii=False,indent=2))
(R/f'qa/glb_structure_{VERSION}.json').write_text(json.dumps({'animations':names,'skins':len(doc.get('skins',[])),'joints':len(doc['skins'][0]['joints']),'bytes':len(raw),'maxInfluences':4,'trimmedVertexCount':trimmed},indent=2))
print('EXPORTED',names,'trimmed',trimmed,'bytes',len(raw))
