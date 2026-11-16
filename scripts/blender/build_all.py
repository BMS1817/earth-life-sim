"""Строит модели сцены и рендерит их в пиксельные спрайты (скилл blender-to-pixel).

Пакетно: blender.exe -b --factory-startup -P scripts/blender/build_all.py
Выход: public/art/ (PNG-листы + JSON). Модели не сохраняются — источник этот скрипт.
Ручные доведённые модели — assets/blender/hand/ (не перезаписывать).
"""
import math
import os
import sys
from pathlib import Path

import bpy
import mathutils

ROOT = Path(__file__).resolve().parent.parent.parent
SKILL = Path(r"D:\Clode\Global\skills\blender-to-pixel\scripts")
sys.path.insert(0, str(SKILL))
import render_sprites as rs  # noqa: E402

OUT = ROOT / "public" / "art"
PREVIEW = 8


def cfg(preset):
    return rs.load_config(str(ROOT / "assets" / "sprites.json"), preset)


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)


def mat(name, hexcolor):
    m = bpy.data.materials.new(name)

    def lin(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    m.diffuse_color = (
        lin(int(hexcolor[0:2], 16)),
        lin(int(hexcolor[2:4], 16)),
        lin(int(hexcolor[4:6], 16)),
        1,
    )
    return m


def finish(ob, material, name):
    ob.name = name
    ob.data.materials.append(material)
    return ob


def box(m, name, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, name)


def sphere(m, name, loc, radius, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=loc)
    ob = bpy.context.object
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, name)


def cyl(m, name, loc, radius, depth):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=depth, location=loc)
    return finish(bpy.context.object, m, name)


def cone(m, name, loc, r1, r2, depth):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r1, radius2=r2, depth=depth, location=loc)
    return finish(bpy.context.object, m, name)


def gable_roof(m, name, width, depth, z_base, height):
    """Двускатная крыша — треугольная призма."""
    w, d = width / 2, depth / 2
    verts = [
        (-w, -d, z_base), (w, -d, z_base), (0, -d, z_base + height),
        (-w, d, z_base), (w, d, z_base), (0, d, z_base + height),
    ]
    faces = [(0, 1, 2), (3, 5, 4), (0, 2, 5, 3), (1, 4, 5, 2), (0, 3, 4, 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, m, name)


def build_person(stage, variant=0):
    clear()
    skin = mat("skin", "d8a878")
    hair = mat("hair", "c8c8c8" if stage == "senior" else "5a3a22" if variant == 2 else "2a2018")
    shirt = mat("shirt", "c04030")
    pants = mat("pants", "3a4a66")
    shoes = mat("shoes", "2a2018")
    belt = mat("belt", "6a5038")
    width = (0.19, 0.24, 0.155)[variant]
    leg_width = (0.072, 0.09, 0.06)[variant]
    parts = []
    for side in (-1, 1):
        x = side * (0.085 if variant != 1 else 0.105)
        parts.append(cyl(pants, "leg", (x, 0, 0.4), leg_width, 0.72))
        parts.append(box(shoes, "shoe", (x + 0.025, -0.035, 0.05), (0.17, 0.25, 0.1)))
    parts.append(cone(shirt, "torso", (0, 0, 1.0), width * 0.86, width, 0.58))
    if variant == 1:
        parts.append(cone(shirt, "coat", (0, 0, 0.77), width * 0.95, width * 0.87, 0.36))
        parts.append(box(belt, "belt", (0, -0.01, 0.89), (width * 1.75, 0.26, 0.055)))
    elif variant == 2:
        parts.append(cone(shirt, "tunic", (0, 0, 0.79), width * 1.18, width * 0.82, 0.34))
        parts.append(box(belt, "belt", (0, -0.01, 0.91), (width * 1.7, 0.24, 0.045)))
    for side in (-1, 1):
        shoulder = (side * (width + 0.025), 0, 1.19)
        hand = (side * (width + 0.055), -0.015, 0.79)
        parts.append(beam(shirt, "sleeve", shoulder, hand, 0.052, 0.043))
        parts.append(sphere(skin, "hand", hand, 0.058, (0.85, 0.85, 1.05)))
    parts.append(cyl(skin, "neck", (0, 0, 1.3), 0.075, 0.14))
    parts.append(sphere(skin, "head", (0, 0, 1.47), 0.215, (0.96, 0.94, 1.04)))
    parts.append(sphere(hair, "hair_cap", (-0.025, 0.015, 1.59), 0.215, (1, 1, 0.55)))
    parts.append(box(hair, "hair_back", (-0.16, 0.015, 1.48), (0.09, 0.24, 0.22)))
    if variant == 1:
        parts.append(sphere(hair, "hair_bun", (-0.16, 0.025, 1.65), 0.105))
        parts.append(box(shirt, "shoulder_wrap", (-0.03, -0.01, 1.22), (width * 2.05, 0.3, 0.1)))
    elif variant == 2:
        parts.append(sphere(hair, "long_hair", (-0.145, 0.035, 1.34), 0.16, (0.62, 0.82, 1.35)))
    parts.append(box(shoes, "eye", (0.17, -0.07, 1.5), (0.045, 0.055, 0.045)))
    parts.append(box(hair, "brow", (0.155, -0.065, 1.55), (0.075, 0.06, 0.025)))
    parts.append(sphere(skin, "nose", (0.215, -0.005, 1.44), 0.045, (1, 0.9, 0.85)))
    if stage == "senior":
        if variant == 1:
            parts.append(sphere(hair, "beard", (0.12, -0.01, 1.32), 0.14, (0.8, 0.9, 1.1)))
        if variant == 2:
            parts.append(beam(belt, "cane", (0.34, -0.04, 0.02), (0.34, -0.04, 0.91), 0.025))
            parts.append(beam(belt, "cane_handle", (0.34, -0.04, 0.91), (0.43, -0.04, 0.91), 0.025))
    scale = {"child": 0.57, "teen": 0.82, "adult": 1.0, "senior": 0.97}[stage]
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    for ob in parts:
        ob.parent = root
    base_lean = 0.09 if stage == "senior" else 0.0
    root.animation_data_create()
    for name, keys in (
        ("idle", [(1, 1.0, 0.0), (2, 1.012, 0.008), (3, 1.0, 0.0), (4, 0.994, -0.004)]),
        ("happy", [(1, 1.0, 0.0), (2, 1.025, 0.035 * scale), (3, 1.01, 0.012 * scale), (4, 1.0, 0.0)]),
        ("sad", [(1, 0.995, 0.0), (2, 0.975, -0.015), (3, 0.975, -0.015), (4, 0.985, -0.005)]),
    ):
        act = bpy.data.actions.new(name)
        root.animation_data.action = act
        if hasattr(root.animation_data, "action_slot") and len(act.slots):
            root.animation_data.action_slot = act.slots[0]
        for fr, sz, height in keys:
            root.scale = (scale, scale, scale * sz)
            root.location.z = 0 if stage == "senior" and name == "sad" else height
            root.rotation_euler = (0, base_lean + (0.1 if name == "sad" and stage != "senior" else 0), 0)
            root.keyframe_insert(data_path="scale", frame=fr)
            root.keyframe_insert(data_path="location", frame=fr)
            root.keyframe_insert(data_path="rotation_euler", frame=fr)
    person_cfg = cfg("person")
    person_cfg["actor"] = "root"
    person_cfg["animations"] = ["idle", "happy", "sad"]
    suffix = "" if variant == 0 else f"_v{variant}"
    rs.render(person_cfg, str(OUT), f"person_{stage}{suffix}", PREVIEW)


def build_house(level):
    clear()
    wall = mat("wall", "c8a878" if level == "poor" else "a8a8a8" if level == "rich" else "c8a878")
    wood = mat("wood", "8a6848")
    roof = mat("roof", "a84a3a")
    glass = mat("glass", "a0d0e0")
    if level == "poor":
        box(wall, "hut", (0, 0, 0.5), (1.6, 1.2, 1.0))
        box(wood, "roof", (0, 0, 1.05), (1.75, 1.35, 0.12))
        box(wood, "door", (0.3, -0.61, 0.4), (0.35, 0.05, 0.8))
        box(glass, "window", (-0.4, -0.61, 0.65), (0.35, 0.05, 0.3))
    elif level == "mid":
        box(wall, "house", (0, 0, 0.65), (2.0, 1.5, 1.3))
        gable_roof(roof, "roof", 2.2, 1.7, 1.3, 0.6)
        box(wood, "door", (0, -0.76, 0.45), (0.4, 0.05, 0.9))
        for x in (-0.65, 0.65):
            box(glass, "window", (x, -0.76, 0.85), (0.4, 0.05, 0.4))
    else:
        box(wall, "manor", (0, 0, 1.1), (2.4, 1.8, 2.2))
        gable_roof(roof, "roof", 2.6, 2.0, 2.2, 0.7)
        box(wood, "door", (0, -0.91, 0.5), (0.5, 0.06, 1.0))
        for x in (-0.8, 0.8):
            for z in (0.7, 1.6):
                box(glass, "window", (x, -0.91, z), (0.45, 0.06, 0.5))
    rs.render(cfg("house"), str(OUT), f"house_{level}", PREVIEW)


def flat_poly(m, name, points, y=0):
    verts = [(x, y, z) for x, z in points]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [tuple(range(len(verts)))])
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, m, name)


def ico(m, name, loc, radius, scale=(1, 1, 1), subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=loc)
    ob = bpy.context.object
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, name)


def beam(m, name, start, end, radius, end_radius=None):
    a, b = mathutils.Vector(start), mathutils.Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cone_add(
        vertices=7,
        radius1=radius,
        radius2=radius if end_radius is None else end_radius,
        depth=direction.length,
        location=(a + b) / 2,
    )
    ob = bpy.context.object
    ob.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return finish(ob, m, name)


def build_deciduous(x, scale, trunk, bark_light, leaves):
    beam(trunk, "trunk", (x, 0, 0), (x - 0.04 * scale, 0, 0.82 * scale), 0.075 * scale, 0.038 * scale)
    beam(bark_light, "trunk_light", (x - 0.035 * scale, -0.045, 0.08), (x - 0.075 * scale, -0.045, 0.68 * scale), 0.018 * scale)
    for side in (-1, 1):
        beam(trunk, "root", (x, 0, 0.12 * scale), (x + side * 0.17 * scale, -0.01, 0.015), 0.045 * scale, 0.012)
        beam(trunk, "branch", (x, 0, 0.55 * scale), (x + side * 0.28 * scale, 0, 0.94 * scale), 0.04 * scale, 0.018 * scale)
    crowns = [
        (-0.27, 0.93, 0.25, 0), (0.23, 0.96, 0.28, 0),
        (-0.12, 1.18, 0.3, 1), (0.18, 1.22, 0.25, 1),
        (0.0, 1.39, 0.22, 2), (-0.32, 1.14, 0.18, 1),
    ]
    for dx, z, radius, shade in crowns:
        ico(leaves[shade], "crown", (x + dx * scale, 0, z * scale), radius * scale, (1, 0.72, 0.88), 2)


def build_conifer(x, scale, trunk, needles, snow=None):
    beam(trunk, "trunk", (x, 0, 0), (x, 0, 1.35 * scale), 0.05 * scale, 0.018 * scale)
    for i, (z, radius, depth) in enumerate(((0.42, 0.36, 0.5), (0.7, 0.3, 0.48), (0.96, 0.23, 0.43), (1.18, 0.15, 0.35))):
        cone(needles[i % 2], "fir_tier", (x, 0, z * scale), radius * scale, 0.012, depth * scale)
        if snow is not None and i < 3:
            ico(snow, "snow_clump", (x - radius * 0.3 * scale, -0.12 * scale, (z + 0.1) * scale), 0.12 * scale, (1.35, 0.42, 0.32), 1)


def build_palm(x, scale, trunk, bark_light, leaves):
    points = [(x, 0, 0), (x - 0.04 * scale, 0, 0.38 * scale), (x + 0.02 * scale, 0, 0.76 * scale), (x + 0.14 * scale, 0, 1.12 * scale)]
    for i in range(3):
        beam(trunk if i != 1 else bark_light, "palm_trunk", points[i], points[i + 1], (0.055 - i * 0.008) * scale, (0.047 - i * 0.008) * scale)
    crown = mathutils.Vector(points[-1])
    for i in range(7):
        angle = i * math.tau / 7
        direction = mathutils.Vector((math.cos(angle), math.sin(angle), 0))
        side = mathutils.Vector((-math.sin(angle), math.cos(angle), 0))
        middle = crown + direction * (0.32 * scale) + mathutils.Vector((0, 0, 0.08 * scale))
        tip = crown + direction * (0.62 * scale) + mathutils.Vector((0, 0, -0.18 * scale))
        verts = [crown, middle + side * 0.105 * scale, tip, middle - side * 0.105 * scale]
        mesh = bpy.data.meshes.new("palm_frond")
        mesh.from_pydata(verts, [], [(0, 1, 2), (0, 2, 3)])
        mesh.update()
        ob = bpy.data.objects.new("palm_frond", mesh)
        bpy.context.scene.collection.objects.link(ob)
        finish(ob, leaves[i % len(leaves)], "palm_frond")
    ico(leaves[1], "coconut", crown + mathutils.Vector((0.03, -0.04, -0.08)), 0.07 * scale, (1, 1, 0.8), 1)


def build_background(climate):
    def bg_cfg(preset):
        c = cfg(preset)
        c["engine"] = "workbench"
        return c

    orig_set_engine = rs.set_engine

    def flat_set_engine(scene, c):
        orig_set_engine(scene, c)
        scene.display.shading.light = "FLAT"

    rs.set_engine = flat_set_engine
    colors = {
        "north": {"sky": "d8ecf8", "cloud": "f4f8fa", "ridge": "a8bdc8", "hill": "c8d8df", "ground": "e8eef2", "path": "c8d8df", "leaves": ("29473f", "3f6b4f", "55706a")},
        "temperate": {"sky": "7ec0e8", "cloud": "d8ecf8", "ridge": "55706a", "hill": "6f8f70", "ground": "6a9a5b", "path": "b8a070", "leaves": ("3a5f38", "4a7a43", "6f9f63")},
        "tropics": {"sky": "a8d8f0", "cloud": "f4f8fa", "ridge": "b8a070", "hill": "c8ae78", "ground": "d8c08a", "path": "b89a62", "leaves": ("23594a", "36805b", "67a65f")},
    }[climate]
    clear()
    box(mat("sky", colors["sky"]), "sky", (0, 0, 0), (8, 0.05, 3))
    cloud = mat("cloud", colors["cloud"])
    for x, z, width in ((-2.35, 0.75, 0.52), (1.65, 0.98, 0.42)):
        box(cloud, "cloud_base", (x, -0.05, z), (width * 2, 0.04, 0.12))
        ico(cloud, "cloud_cap", (x - width * 0.25, -0.06, z + 0.06), width * 0.55, (1, 0.12, 0.42), 2)
        ico(cloud, "cloud_cap", (x + width * 0.35, -0.06, z + 0.03), width * 0.42, (1, 0.12, 0.38), 2)
    rs.render(bg_cfg("sky"), str(OUT), f"bg_{climate}_sky", PREVIEW)
    clear()
    ridge = mat("ridge", colors["ridge"])
    hill = mat("hill", colors["hill"])
    ground = mat("ground", colors["ground"])
    trunk = mat("trunk", "6a5038")
    bark_light = mat("bark_light", "a88860")
    leaves = [mat(f"leaf_{i}", color) for i, color in enumerate(colors["leaves"])]
    if climate == "north":
        flat_poly(ridge, "mountains", [(-4, -0.2), (-4, 0.45), (-3.1, 1.25), (-2.5, 0.72), (-1.55, 1.48), (-0.75, 0.68), (0.35, 1.12), (1.25, 0.55), (2.3, 1.32), (4, 0.42), (4, -0.2)], 0.8)
        flat_poly(mat("snow", "e8eef2"), "snow_peaks", [(-3.35, 0.97), (-3.1, 1.25), (-2.85, 0.98), (-3.08, 1.07), (-1.82, 1.13), (-1.55, 1.48), (-1.28, 1.1), (-1.54, 1.2), (2.03, 1.02), (2.3, 1.32), (2.57, 0.98), (2.3, 1.09)], 0.76)
        flat_poly(hill, "snow_hills", [(-4, -0.2), (-4, 0.14), (-2.8, 0.48), (-1.5, 0.18), (0.1, 0.42), (1.6, 0.16), (3.1, 0.36), (4, 0.2), (4, -0.2)], 0.3)
        for x, size in ((-3.25, 0.88), (-2.15, 0.68), (1.7, 0.82), (3.05, 1.0)):
            build_conifer(x, size, trunk, leaves, mat("tree_snow", "e8eef2"))
    elif climate == "temperate":
        flat_poly(ridge, "distant_hills", [(-4, -0.2), (-4, 0.45), (-3, 0.8), (-2.1, 0.62), (-0.9, 0.94), (0.4, 0.58), (1.55, 0.88), (2.8, 0.62), (4, 0.75), (4, -0.2)], 0.8)
        flat_poly(hill, "near_hills", [(-4, -0.2), (-4, 0.12), (-2.7, 0.38), (-1.4, 0.19), (0.2, 0.32), (1.6, 0.15), (3, 0.35), (4, 0.2), (4, -0.2)], 0.3)
        for x, size in ((-3.1, 0.86), (-1.95, 0.64), (1.8, 0.78), (3.15, 0.96)):
            build_deciduous(x, size, trunk, bark_light, leaves)
    else:
        flat_poly(ridge, "cliffs", [(-4, -0.2), (-4, 0.5), (-3.3, 0.78), (-2.75, 0.73), (-2.55, 1.05), (-1.8, 1.02), (-1.55, 0.55), (-0.4, 0.4), (0.7, 0.7), (1.5, 0.67), (1.85, 1.0), (2.75, 0.92), (3.1, 0.5), (4, 0.36), (4, -0.2)], 0.8)
        flat_poly(hill, "sand_hills", [(-4, -0.2), (-4, 0.12), (-2.7, 0.3), (-1.3, 0.12), (0.4, 0.28), (1.9, 0.12), (3.2, 0.32), (4, 0.18), (4, -0.2)], 0.3)
        for x, size in ((-3.15, 0.92), (-2.0, 0.68), (1.85, 0.82), (3.2, 1.0)):
            build_palm(x, size, trunk, bark_light, leaves)
    box(ground, "far_ground", (0, 0.2, -0.65), (8, 2, 1.3))
    rs.render(bg_cfg("far"), str(OUT), f"bg_{climate}_far", PREVIEW)
    clear()
    ground = mat("ground", colors["ground"])
    path = mat("path", colors["path"])
    stone = mat("stone", "888890" if climate != "tropics" else "8a7a54")
    box(ground, "ground", (0, 0, -0.6), (8, 2, 1.2))
    flat_poly(path, "trail", [(-4, -0.02), (-2.6, 0.04), (-1.5, -0.08), (-0.3, -0.22), (1.1, -0.3), (2.6, -0.22), (4, -0.05), (4, -0.5), (2.4, -0.56), (0.8, -0.52), (-0.6, -0.4), (-2.1, -0.22), (-4, -0.25)], -1.05)
    for x, z, size in ((-3.25, 0.02, 0.2), (-1.15, 0.0, 0.12), (2.75, 0.04, 0.24)):
        ico(stone, "rock", (x, -0.15, z), size, (1.25, 0.8, 0.7), 1)
        ico(path, "rock_light", (x - size * 0.18, -0.24, z + size * 0.35), size * 0.5, (1, 0.4, 0.35), 1)
    grass = mat("grass", colors["leaves"][1])
    for x in (-3.65, -2.75, -1.65, -0.7, 0.65, 1.45, 2.25, 3.55):
        height = 0.12 + (abs(x) % 0.3) * 0.25
        flat_poly(grass, "grass_tuft", [(x - 0.09, 0), (x - 0.06, height * 0.65), (x - 0.02, height * 0.3), (x + 0.02, height), (x + 0.04, height * 0.3), (x + 0.1, height * 0.7), (x + 0.08, 0)], -0.85)
    rs.render(bg_cfg("near"), str(OUT), f"bg_{climate}_near", PREVIEW)


def war_idle(root, amount=0.03, horizontal=False):
    root.animation_data_create()
    act = bpy.data.actions.new("idle")
    root.animation_data.action = act
    if hasattr(root.animation_data, "action_slot") and len(act.slots):
        root.animation_data.action_slot = act.slots[0]
    for fr, delta in ((1, 0), (2, amount), (3, 0), (4, -amount * 0.5)):
        if horizontal:
            root.location.x = delta
        else:
            root.location.z = delta
        root.keyframe_insert(data_path="location", frame=fr)


def build_war_soldier():
    clear()
    skin = mat("skin", "d8a878")
    uniform = mat("uniform", "55706a")
    dark = mat("dark", "2e3a44")
    helmet = mat("helmet", "3a5f38")
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    parts = [
        cyl(dark, "leg_l", (-0.09, 0, 0.42), 0.075, 0.75),
        cyl(dark, "leg_r", (0.09, 0, 0.42), 0.075, 0.75),
        cone(uniform, "torso", (0, 0, 1.0), 0.17, 0.2, 0.55),
        cyl(uniform, "arm_l", (-0.24, 0, 1.0), 0.055, 0.5),
        cyl(uniform, "arm_r", (0.24, 0, 1.0), 0.055, 0.5),
        sphere(skin, "head", (0, 0, 1.45), 0.21),
        sphere(helmet, "helmet", (0, 0.02, 1.58), 0.23, (1, 1, 0.55)),
        box(dark, "eye", (0.16, -0.06, 1.48), (0.04, 0.06, 0.04)),
        sphere(skin, "nose", (0.2, 0, 1.42), 0.04),
        box(dark, "rifle", (0.28, -0.04, 0.85), (0.08, 0.08, 0.7)),
    ]
    for ob in parts:
        ob.parent = root
    root.rotation_euler.z = 0
    war_idle(root)
    c = cfg("person")
    c["actor"] = "root"
    c["animations"] = ["idle"]
    rs.render(c, str(OUT), "war_soldier", PREVIEW)


def build_war_tank():
    clear()
    body = mat("body", "55706a")
    dark = mat("dark", "2e3a44")
    metal = mat("metal", "888890")
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    parts = [
        box(dark, "track_l", (0, -0.45, 0.22), (2.4, 0.45, 0.4)),
        box(dark, "track_r", (0, 0.45, 0.22), (2.4, 0.45, 0.4)),
        box(body, "hull", (0, 0, 0.52), (2.2, 1.1, 0.55)),
        cyl(body, "turret", (0.15, 0, 0.92), 0.48, 0.35),
        box(body, "barrel", (0.95, 0, 0.98), (1.45, 0.12, 0.12)),
        box(metal, "hatch", (0.05, 0, 1.14), (0.35, 0.35, 0.08)),
    ]
    for x in (-0.8, -0.25, 0.3, 0.85):
        parts.append(cyl(metal, "wheel", (x, -0.69, 0.22), 0.17, 0.08))
    for ob in parts:
        ob.parent = root
    root.rotation_euler.z = 0
    war_idle(root, 0.04, True)
    c = cfg("tank")
    c["actor"] = "root"
    c["animations"] = ["idle"]
    rs.render(c, str(OUT), "war_tank", PREVIEW)


def build_war_smoke():
    clear()
    grey = mat("grey", "888890")
    dark = mat("dark", "4a5a66")
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    for i, (x, z, r) in enumerate(((0, 0.2, 0.45), (0.15, 0.65, 0.55), (-0.1, 1.15, 0.65), (0.25, 1.65, 0.5))):
        ob = sphere(grey if i % 2 else dark, "smoke", (x, 0, z), r, (1, 0.7, 1.15))
        ob.parent = root
    root.scale.z = 0.75
    war_idle(root, 0.08)
    c = cfg("smoke")
    c["actor"] = "root"
    c["animations"] = ["idle"]
    rs.render(c, str(OUT), "war_smoke", PREVIEW)


def build_damaged_house():
    clear()
    wall = mat("wall", "c8a878")
    wood = mat("wood", "8a6848")
    roof = mat("roof", "a84a3a")
    dark = mat("dark", "2e3a44")
    box(wall, "house", (0, 0, 0.65), (2.0, 1.5, 1.3))
    box(roof, "roof_left", (-0.62, 0, 1.42), (0.85, 1.65, 0.16))
    for x in (-0.25, 0.3, 0.75):
        beam = box(wood, "beam", (x, 0, 1.45), (0.09, 1.55, 0.65))
        beam.rotation_euler.y = -0.35
    box(dark, "door", (0, -0.76, 0.45), (0.4, 0.05, 0.9))
    box(dark, "window_broken", (-0.65, -0.76, 0.85), (0.4, 0.05, 0.4))
    box(wood, "crack", (0.55, -0.77, 0.7), (0.07, 0.03, 0.65))
    rs.render(cfg("house"), str(OUT), "house_damaged", PREVIEW)


def build_evacuee():
    clear()
    skin = mat("skin", "d8a878")
    hair = mat("hair", "2a2018")
    shirt = mat("shirt", "88b8c8")
    pants = mat("pants", "3a4a66")
    bag = mat("bag", "8a7a54")
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    parts = [
        cyl(pants, "leg_l", (-0.09, 0, 0.42), 0.075, 0.75),
        cyl(pants, "leg_r", (0.09, 0, 0.42), 0.075, 0.75),
        cone(shirt, "torso", (0, 0, 1.0), 0.17, 0.2, 0.55),
        cyl(shirt, "arm_l", (-0.24, 0, 1.0), 0.055, 0.5),
        cyl(shirt, "arm_r", (0.24, 0, 1.0), 0.055, 0.5),
        sphere(skin, "head", (0, 0, 1.45), 0.21),
        sphere(hair, "hair", (0, 0.02, 1.55), 0.21, (1, 1, 0.6)),
        box(hair, "eye", (0.16, -0.06, 1.48), (0.04, 0.06, 0.04)),
        sphere(skin, "nose", (0.2, 0, 1.42), 0.04),
        box(bag, "backpack", (-0.2, 0.08, 1.0), (0.22, 0.3, 0.5)),
    ]
    for ob in parts:
        ob.parent = root
    root.rotation_euler.z = 0
    war_idle(root)
    c = cfg("evacuee")
    c["actor"] = "root"
    c["animations"] = ["idle"]
    rs.render(c, str(OUT), "person_evacuee", PREVIEW)


def build_career_model(career):
    clear()
    colors = {
        "medicine": ("c8c8c8", "3a4a66"),
        "education": ("b89858", "8a6848"),
        "engineering": ("3a4a66", "2e3a44"),
        "industry": ("b05a4a", "888890"),
        "agriculture": ("6a9a5b", "4a7a43"),
        "services": ("55706a", "8a7a54"),
        "pilot": ("c8c8c8", "3a4a66"),
    }
    shirt_hex, prop_hex = colors[career]
    skin = mat("skin", "d8a878")
    hair = mat("hair", "2a2018")
    shirt = mat("shirt", shirt_hex)
    pants = mat("pants", "3a4a66")
    prop = mat("prop", prop_hex)
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    parts = [
        cyl(pants, "leg_l", (-0.09, 0, 0.42), 0.075, 0.75),
        cyl(pants, "leg_r", (0.09, 0, 0.42), 0.075, 0.75),
        cone(shirt, "torso", (0, 0, 1.0), 0.17, 0.2, 0.55),
        cyl(shirt, "arm_l", (-0.24, 0, 1.0), 0.055, 0.5),
        cyl(shirt, "arm_r", (0.24, 0, 1.0), 0.055, 0.5),
        sphere(skin, "head", (0, 0, 1.45), 0.21),
        sphere(hair, "hair", (0, 0.02, 1.55), 0.21, (1, 1, 0.6)),
        box(hair, "eye", (0.16, -0.06, 1.48), (0.04, 0.06, 0.04)),
        sphere(skin, "nose", (0.2, 0, 1.42), 0.04),
    ]
    prop_type = {"medicine": "book", "education": "case", "engineering": "laptop", "industry": "wrench", "agriculture": "plant", "services": "tool", "pilot": "cap"}[career]
    if prop_type in ("book", "case"):
        prop_ob = box(prop, "book", (0.28, -0.03, 1.02), (0.28, 0.08, 0.22))
    elif prop_type == "laptop":
        prop_ob = box(prop, "laptop", (0.28, -0.03, 1.02), (0.3, 0.06, 0.22))
    elif prop_type == "plant":
        prop_ob = cone(prop, "plant", (0.28, -0.03, 1.05), 0.1, 0.01, 0.28)
    elif prop_type == "cap":
        prop_ob = box(prop, "cap", (0, -0.01, 1.64), (0.38, 0.3, 0.09))
        parts.append(box(prop, "cap_visor", (0.17, -0.05, 1.59), (0.2, 0.2, 0.035)))
    else:
        prop_ob = box(prop, "tool", (0.28, -0.03, 1.05), (0.08, 0.08, 0.35))
    parts.append(prop_ob)
    for ob in parts:
        ob.parent = root
    root.rotation_euler.z = 0
    root.animation_data_create()
    act = bpy.data.actions.new("idle")
    root.animation_data.action = act
    if hasattr(root.animation_data, "action_slot") and len(act.slots):
        root.animation_data.action_slot = act.slots[0]
    for fr, delta in ((1, 0), (2, 0.05), (3, 0), (4, -0.02)):
        root.location.z = delta
        root.keyframe_insert(data_path="location", frame=fr)
    c = cfg("person")
    c["actor"] = "root"
    c["animations"] = ["idle"]
    rs.render(c, str(OUT), f"career_{career}", PREVIEW)


def build_war():
    build_war_soldier()
    build_war_tank()
    build_war_smoke()
    build_damaged_house()
    build_evacuee()


def build_careers():
    for career in ("medicine", "education", "engineering", "industry", "agriculture", "services", "pilot"):
        build_career_model(career)


def main():
    if "--people-only" in sys.argv:
        for stage in ("child", "teen", "adult", "senior"):
            for variant in (0, 1, 2):
                build_person(stage, variant)
    elif "--backgrounds-only" in sys.argv:
        for climate in ("north", "temperate", "tropics"):
            build_background(climate)
    elif "--careers-only" in sys.argv:
        build_careers()
    else:
        if "--war-only" not in sys.argv:
            for stage in ("child", "teen", "adult", "senior"):
                for variant in (0, 1, 2):
                    build_person(stage, variant)
            for level in ("poor", "mid", "rich"):
                build_house(level)
            for climate in ("north", "temperate", "tropics"):
                build_background(climate)
        build_war()
        build_careers()
    print("[build_all] done")


if __name__ == "__main__":
    main()
