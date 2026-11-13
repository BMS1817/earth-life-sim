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


def build_person(stage):
    clear()
    skin = mat("skin", "d8a878")
    hair = mat("hair", "c8c8c8" if stage == "senior" else "2a2018")
    shirt = mat("shirt", "c04030")
    pants = mat("pants", "3a4a66")
    shoes = mat("shoes", "2a2018")
    parts = []
    parts.append(cyl(pants, "leg_l", (-0.09, 0, 0.42), 0.075, 0.75))
    parts.append(cyl(pants, "leg_r", (0.09, 0, 0.42), 0.075, 0.75))
    parts.append(box(shoes, "shoe_l", (-0.09, -0.04, 0.05), (0.14, 0.24, 0.1)))
    parts.append(box(shoes, "shoe_r", (0.09, -0.04, 0.05), (0.14, 0.24, 0.1)))
    torso = cone(shirt, "torso", (0, 0, 1.0), 0.17, 0.2, 0.55)
    parts.append(torso)
    parts.append(cyl(shirt, "arm_l", (-0.24, 0, 1.0), 0.055, 0.5))
    parts.append(cyl(shirt, "arm_r", (0.24, 0, 1.0), 0.055, 0.5))
    parts.append(sphere(skin, "head", (0, 0, 1.45), 0.21))
    parts.append(sphere(hair, "hair", (0, 0.02, 1.55), 0.21, (1, 1, 0.6)))
    parts.append(box(shoes, "eye", (0.16, -0.06, 1.48), (0.04, 0.06, 0.04)))
    parts.append(sphere(skin, "nose", (0.2, 0, 1.42), 0.04))
    if stage == "senior":
        torso.rotation_euler.x = 0.12
    scale = {"child": 0.55, "teen": 0.8, "adult": 1.0, "senior": 1.0}[stage]
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    for ob in parts:
        ob.parent = root
    root.scale = (scale, scale, scale)
    if stage == "child":
        bpy.data.objects["head"].scale = (1.25, 1.25, 1.25)
    root.rotation_euler.z = math.pi / 2  # профиль: модель смотрит в +X
    # Все анимации на root: idle (дыхание), happy (прыжок), sad (понурость)
    root.animation_data_create()
    for name, keys in (
        ("idle", [(1, 1.0), (2, 1.015), (3, 1.0), (4, 0.99)]),
        ("happy", [(1, 1.0), (2, 1.03), (3, 1.0), (4, 1.0)]),
        ("sad", [(1, 1.0), (2, 0.97), (3, 0.97), (4, 0.98)]),
    ):
        act = bpy.data.actions.new(name)
        root.animation_data.action = act
        if hasattr(root.animation_data, "action_slot") and len(act.slots):
            root.animation_data.action_slot = act.slots[0]
        for fr, sz in keys:
            root.scale = (scale, scale, scale * sz)
            root.keyframe_insert(data_path="scale", frame=fr)
            if name == "happy":
                root.location.z = {1: 0, 2: 0.15 * scale, 3: 0.03 * scale, 4: 0}[fr]
                root.keyframe_insert(data_path="location", frame=fr)
            if name == "sad":
                root.location.z = 0
                root.keyframe_insert(data_path="location", frame=fr)
    person_cfg = cfg("person")
    person_cfg["actor"] = "root"
    person_cfg["animations"] = ["idle", "happy", "sad"]
    rs.render(person_cfg, str(OUT), f"person_{stage}", PREVIEW)


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


def build_background(climate):
    def em(name, hexcolor):
        return mat(name, hexcolor)

    def bg_cfg(preset):
        c = cfg(preset)
        c["engine"] = "workbench"
        return c

    orig_set_engine = rs.set_engine

    def flat_set_engine(scene, c):
        orig_set_engine(scene, c)
        scene.display.shading.light = "FLAT"

    rs.set_engine = flat_set_engine

    sky_colors = {"north": "d8ecf8", "temperate": "7ec0e8", "tropics": "a8d8f0"}
    hill_colors = {"north": "e8eef2", "temperate": "55706a", "tropics": "d8c08a"}
    ground_colors = {"north": "e8eef2", "temperate": "6a9a5b", "tropics": "d8c08a"}
    leaf_colors = {"north": "4a7a43", "temperate": "4a7a43", "tropics": "3a5f38"}
    clear()
    m = em("sky", sky_colors[climate])
    box(m, "sky", (0, 0, 0), (8, 0.05, 3))
    rs.render(bg_cfg("sky"), str(OUT), f"bg_{climate}_sky", 0)
    clear()
    hm = em("hills", hill_colors[climate])
    for x, z, r in ((-2.2, 0.1, 1.1), (0.2, 0.0, 0.8), (2.3, 0.15, 1.0)):
        sphere(hm, "hill", (x, 0.3, z), r, (1.4, 0.8, 0.45))
    rs.render(bg_cfg("far"), str(OUT), f"bg_{climate}_far", 0)
    clear()
    gm = em("ground", ground_colors[climate])
    lm = em("leaf", leaf_colors[climate])
    trunk = em("trunk", "6a5038")
    box(gm, "ground", (0, 0, -0.6), (8, 2, 1.2))
    for x in (-2.5, 0.8, 2.8):
        if climate == "north":
            cyl(trunk, "trunk", (x, 0, 0.25), 0.05, 0.5)
            cone(lm, "fir", (x, 0, 0.6), 0.3, 0.02, 0.7)
            cone(em("snow", "e8eef2"), "snowcap", (x, 0, 0.85), 0.16, 0.02, 0.25)
        elif climate == "temperate":
            cyl(trunk, "trunk", (x, 0, 0.3), 0.06, 0.6)
            sphere(lm, "crown", (x, 0, 0.85), 0.4)
        else:
            cyl(trunk, "trunk", (x, 0, 0.45), 0.05, 0.9)
            for a in range(4):
                leaf = box(lm, "palm", (x, 0, 0.95), (0.7, 0.12, 0.06))
                leaf.rotation_euler.z = a * math.pi / 4
    rs.render(bg_cfg("near"), str(OUT), f"bg_{climate}_near", 0)


def main():
    for stage in ("child", "teen", "adult", "senior"):
        build_person(stage)
    for level in ("poor", "mid", "rich"):
        build_house(level)
    for climate in ("north", "temperate", "tropics"):
        build_background(climate)
    print("[build_all] done")


if __name__ == "__main__":
    main()
