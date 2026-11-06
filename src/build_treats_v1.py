"""Heihei cream pouch + pink paw freeze-dried treat. Blender, meters, packed GLB."""
import bpy, math, random, os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
 m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=rough
 return m
cream=mat('vanilla_pouch',(.88,.79,.63));brown=mat('cocoa_seal',(.075,.025,.012));ink=mat('cocoa_print',(.11,.035,.017));pink=mat('strawberry_paw',(.67,.29,.29));light=mat('paw_highlight',(.94,.62,.57));sand=mat('biscuit_edge',(.72,.48,.30));white=mat('milk_label',(.97,.9,.77))
# Very fine pores use geometry so the same appearance survives glTF export.
def root(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
bag=root('TreatBag');treat=root('PawTreat')
def mesh(name,verts,faces,material,parent):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(material);o.parent=parent
 for p in me.polygons:p.use_smooth=True
 return o
def sphere(name,loc,scale,material,parent,segments=24,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,scale,bevel,material,parent):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.data.materials.append(material)
 mod=o.modifiers.new('soft_edges','BEVEL');mod.width=bevel;mod.segments=4;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 o.modifiers.new('weighted_normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=o.modifiers[-1].name)
 return o
# Front is -Y in Blender / +Z in glTF; pouch height 24 cm.
verts=[];faces=[];N=64
profiles=[(-.118,.064,.018),(-.112,.083,.032),(-.085,.09,.036),(-.025,.093,.037),(.045,.091,.029),(.09,.086,.018),(.103,.087,.012)]
for z,w,d in profiles:
 for i in range(N):
  a=2*math.pi*i/N;x=w*math.copysign(abs(math.cos(a))**.55,math.cos(a));y=d*math.copysign(abs(math.sin(a))**.75,math.sin(a));verts.append((x,y,z))
for j in range(len(profiles)-1):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
faces.extend([tuple(reversed(range(N))),tuple((len(profiles)-1)*N+i for i in range(N))]);mesh('soft_pouch',verts,faces,cream,bag)
box('cocoa_zip_seal',(0,0,.108),(.185,.029,.026),.006,brown,bag)
for z in [.101,.11,.117]:box('seal_ridge',(0,-.015,z),(.17,.0018,.0015),.0007,sand,bag)
box('base_gusset',(0,0,-.113),(.148,.047,.015),.006,cream,bag)
# A cream rounded label with an embossed paw medallion and converted Chinese type.
box('front_label',(0,-.038,-.008),(.151,.003,.158),.018,white,bag)
def paw(parent,origin,size,material,depth_axis='y'):
 x,y,z=origin
 sphere('paw_pad',(x,y,z-size*.12),(size*.43,size*.10,size*.32),material,parent)
 for dx,dz,s in [(-.39,.24,.17),(-.15,.43,.18),(.15,.43,.18),(.39,.24,.17)]:
  sphere('paw_toe',(x+dx*size,y,z+dz*size),(size*s,size*.095,size*.21),material,parent)
paw(bag,(0,-.045,.021),.071,pink)
font=bpy.data.fonts.load(os.environ.get('HEIHEI_LABEL_FONT','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
def text(name,body,z,size,material):
 cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.font=font;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.00015;cu.resolution_u=4
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.location=(0,-.041,z);o.rotation_euler=(math.pi/2,0,0);o.parent=bag;o.data.materials.append(material)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
text('label_cat_treats','猫冻干',-.042,.035,ink);text('label_heihei','H E I H E I',.072,.012,ink);text('label_footer','LITTLE PAWS · BIG LOVE',-.072,.0065,ink)
# A single baked paw silhouette, soft pink biscuit with a cream edge.
# In Blender the snack lies on XY; after export it lies on the ground XZ.
sphere('biscuit_pad',(0,-.006,0),(.027,.021,.01),sand,treat)
sphere('pink_pad',(0,-.006,.004),(.025,.02,.009),pink,treat)
for x,y,r in [(-.026,.015,.01),(-.01,.03,.011),(.012,.03,.011),(.028,.013,.0095)]:
 sphere('biscuit_toe',(x,y,0),(r,r*1.2,.008),sand,treat);sphere('pink_toe',(x,y,.004),(r*.92,r*1.1,.007),pink,treat)
rng=random.Random(12)
for i in range(19):
 x=rng.uniform(-.018,.018);y=rng.uniform(-.017,.006)
 sphere('freeze_dried_pore',(x,y,.013),(.0012,.001,.00045),light,treat,8,4)
# Merge the snack into one mesh with three material batches, so many treats stay cheap on mobile.
bpy.ops.object.select_all(action='DESELECT')
for obj in list(treat.children): obj.select_set(True)
bpy.context.view_layer.objects.active=treat.children[0];bpy.ops.object.join()
bpy.context.object.name='paw_biscuit';bpy.context.object['shape']='one pad and four toes'
# Export separated reusable roots at identity.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(R/'web/public/assets/cat_treats_v1.glb'),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
# Editable studio scene, original roots remain named.
treat.location=(.17,-.02,-.106)
floor=mat('studio',(.94,.91,.84));box('studio_floor',(0,0,-.138),(200,200,.02),.001,floor,None)
def area(loc,power,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
area((-.5,-.7,1),55,.7);area((.7,.1,.7),35,.6)
bpy.ops.object.camera_add(location=(.34,-.7,.29));cam=bpy.context.object;cam.rotation_euler=(Vector((.045,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.49
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.samples=32;s.world.color=(.6,.6,.6);s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(R/'qa/web/treats_v1_preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'output/cat_treats_v1.blend'),compress=True);bpy.ops.render.render(write_still=True)
print('TREATS_V1_COMPLETE')
