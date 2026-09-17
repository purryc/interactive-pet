"""Build the Heihei cat wand from local reference; Blender 5.2, deterministic."""
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "web/public/assets/cat_wand_v2.glb"
BLEND = ROOT / "output/cat_wand_v2.blend"
PREVIEW = ROOT / "qa/web/wand_v2_preview.png"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=0.82, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


wood = material("warm_pale_bamboo", (.66, .50, .32))
wood_light = material("bamboo_highlight", (.83, .70, .48))
ivory = material("cotton_rope", (.53, .45, .31))
stone = material("ball_core", (.62, .50, .35))
gold = material("feather_honey", (.47, .27, .08))
cream = material("feather_cream", (.63, .43, .20))
ochre = material("feather_ochre", (.37, .19, .06))
quill = material("quill", (.89, .77, .56))

rod = bpy.data.objects.new("Rod", None)
lure = bpy.data.objects.new("Lure", None)
bpy.context.collection.objects.link(rod)
bpy.context.collection.objects.link(lure)


def parent(obj, root):
    obj.parent = root
    return obj


def smooth(obj):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def tube(name, points, radius, mat, root, resolution=3):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = resolution
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for handle, point in zip(spline.points, points):
        handle.co = (*point, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    parent(obj, root)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    converted=bpy.context.object
    converted.name=name
    converted.parent=root
    return smooth(converted)


def sphere(name, location, scale, mat, root, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    parent(obj, root)
    obj.data.materials.append(mat)
    return smooth(obj)


# The unit rod points down local -Z; glTF converts this to Three.js -Y.
bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=.0072, radius2=.0115, depth=1, location=(0, 0, -.5))
shaft = parent(bpy.context.object, rod)
shaft.name = "Bamboo_shaft"
shaft.data.materials.append(wood_light)
smooth(shaft)
for angle in (0, 2.1, 4.2):
    tube("Bamboo_grain", [(.009 * math.cos(angle + i*.1), .009 * math.sin(angle + i*.1), -.08-i*.075) for i in range(12)], .00045, wood, rod, 2)
sphere("Tip_eyelet", (0, 0, -1), (.010, .010, .013), ivory, rod)
sphere("Grip_end", (0, 0, -.012), (.013, .013, .017), wood, rod)

# Slightly flattened core with crossed cotton cord wrapping, like the reference.
sphere("Woven_core", (0, 0, 0), (.037, .032, .037), stone, lure, 24, 16)
for strand in range(2):
    points = []
    for i in range(241):
        t = i/240
        z = -.034 + .068*t
        radius = .035 * math.sqrt(max(.055, 1-(z/.038)**2)) + .0018
        theta = (t*8.5 + strand*.5)*math.tau*(1 if strand == 0 else -1)
        points.append((radius*math.cos(theta), radius*.87*math.sin(theta), z))
    tube(f"Cotton_weave_{strand+1}", points, .0018, ivory, lure, 3)
sphere("Cord_knot", (0, 0, .036), (.010, .008, .007), ivory, lure)


def feather(name, side, length, width, mat, lean, phase, yaw=0):
    """Layered asymmetrical vanes and separate wispy barbs, rotated around the tuft."""
    def turn(x,y,z):
        return (x*math.cos(yaw)-y*math.sin(yaw),x*math.sin(yaw)+y*math.cos(yaw),z)
    vertices, faces = [], []
    rows, cols = 18, 8
    for i in range(rows+1):
        t = i/rows
        center_x = side*.010 + lean*t*t
        center_y = phase*.008 + .005*math.sin(math.pi*t)
        spine_z = -.026-length*t
        half = width*math.sin(math.pi*min(.999,max(.001,t)))**.55 * (1-.30*t)
        for j in range(cols+1):
            u=2*j/cols-1
            notch = .0015*math.sin(43*t+3*j+phase) * (abs(u)**4) * math.sin(math.pi*t)
            vertices.append(turn(center_x + u*half + notch, center_y + .006*(1-u*u)*math.sin(math.pi*t), spine_z + .009*u*t))
    for i in range(rows):
        for j in range(cols):
            a=i*(cols+1)+j
            faces.append((a,a+1,a+cols+2,a+cols+1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    parent(obj,lure)
    mesh.materials.append(mat)
    solid=obj.modifiers.new("Fine feather thickness","SOLIDIFY")
    solid.thickness=.0008
    smooth(obj)
    tube(name+"_rachis",[turn(side*.010+lean*(i/16)**2,phase*.008+.006*math.sin(math.pi*i/16),-.026-length*i/16) for i in range(17)], .0006, quill, lure, 2)
    # Individual overlapping barbs break the laser-cut edge of the blade.
    fringe_vertices,fringe_faces=[],[]
    for i in range(3,25):
        t=i/28
        center=side*.010+lean*t*t
        y=phase*.008+.005*math.sin(math.pi*t)+.001
        z=-.026-length*t
        radius=width*math.sin(math.pi*t)**.75
        for sign in (-1,1):
            j=len(fringe_vertices)
            fringe_vertices.extend([turn(center,y,z),turn(center+sign*radius*.99,y-.0003,z-.003),turn(center+sign*radius*(1.00+.025*math.sin(i*3.7)),y-.001,z-.007)])
            fringe_faces.append((j,j+1,j+2))
    fringe_mesh=bpy.data.meshes.new(name+"_fringe")
    fringe_mesh.from_pydata(fringe_vertices,[],fringe_faces)
    fringe_obj=bpy.data.objects.new(name+"_barbs",fringe_mesh)
    bpy.context.collection.objects.link(fringe_obj)
    parent(fringe_obj,lure)
    fringe_mesh.materials.append(mat)
    return obj


feather("Honey_plume", 0, .177, .033, gold, .031, 0, .15)
feather("Pale_plume", -1, .146, .025, cream, -.033, 1, .72)
feather("Ochre_plume", 1, .164, .026, ochre, .041, -1, -.48)
feather("Narrow_plume", 0, .127, .017, cream, -.019, -2, 1.24)
feather("Soft_side_plume", 1, .142, .020, gold, .012, 2, 2.08)

# Wispy fibers radiate from the shoulder and run along the tail silhouette.
for i in range(128):
    angle=i*2.39996
    radial=.009+.010*((i*7)%11)/11
    length=.035+.090*((i*13)%17)/17
    side=1 if i%2 else -1
    offset=.004+.022*((i*5)%13)/13
    points=[]
    for j in range(4):
        t=j/3
        points.append((radial*math.cos(angle)+side*(offset*t+.005*t*t),radial*math.sin(angle)+.011*t*math.sin(angle),-.030-length*t))
    tube("Feather_fiber",points,.00025,cream if i%3 else gold,lure,1)

# A small sliding bead next to the toy head is visible when the line flexes.
sphere("Cord_bead", (0,0,.055), (.007,.007,.008), wood_light, lure)

# Apply the feather thickness, then consolidate like materials to keep the
# runtime asset inexpensive on iPad without flattening the Rod/Lure pivots.
for obj in list(bpy.context.scene.objects):
    if obj.type == "MESH" and obj.parent in {rod,lure}:
        bpy.context.view_layer.objects.active=obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
for root in (rod,lure):
    groups={}
    for obj in list(root.children):
        if obj.type == "MESH":
            groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for name,items in groups.items():
        if len(items)<2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in items:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        bpy.ops.object.join()
        items[0].name=f"{root.name}_{name}"

# Export only the two movable assemblies. They share their own origins.
for obj in bpy.context.scene.objects:
    obj.select_set(obj == rod or obj == lure or obj.parent in {rod,lure})
bpy.context.view_layer.objects.active=rod
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format="GLB",use_selection=True,export_apply=True)

# Present the separately animated pieces together in the editable .blend.
lure.location=(.18,0,-1.27)
tube("Preview_cord",[(0,0,-1),(.08,-.015,-1.08),(.27,-.025,-1.08),(.30,-.01,-1.19),(.18,0,-1.215)],.0013,ivory,None,2)
world=bpy.data.worlds.new("Warm studio")
bpy.context.scene.world=world
world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.86,.85,.81,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.5
bpy.ops.object.light_add(type="AREA",location=(1,-1,1))
bpy.context.object.name="Softbox"
bpy.context.object.data.energy=95
bpy.context.object.data.shape="DISK"
bpy.context.object.data.size=2
bpy.ops.object.camera_add(location=(1.5,-2.2,-.58))
camera=bpy.context.object
direction=Vector((.06,0,-.65))-camera.location
camera.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
camera.data.type="ORTHO"
camera.data.ortho_scale=1.95
bpy.context.scene.camera=camera
bpy.context.scene.render.engine="BLENDER_EEVEE"
bpy.context.scene.view_settings.view_transform="Standard"
bpy.context.scene.view_settings.look="Medium High Contrast"
bpy.context.scene.render.resolution_x=1000
bpy.context.scene.render.resolution_y=1000
bpy.context.scene.render.resolution_percentage=100
bpy.context.scene.render.image_settings.file_format="PNG"
bpy.context.scene.render.filepath=str(PREVIEW)
bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=.41
camera.location=(.64,-1.02,-1.30)
direction=Vector((.18,0,-1.32))-camera.location
camera.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
bpy.context.scene.render.filepath=str(ROOT / "qa/web/wand_v2_detail.png")
bpy.ops.render.render(write_still=True)
bpy.context.scene.render.filepath=str(PREVIEW)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
print(f"WAND_BUILD_OK glb={GLB.stat().st_size} blend={BLEND.stat().st_size} preview={PREVIEW.stat().st_size}")
