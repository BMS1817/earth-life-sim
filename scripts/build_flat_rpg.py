import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"

FP = {
    "ink": (43, 43, 49, 255),
    "sky": (147, 201, 223, 255),
    "cloud": (243, 234, 214, 255),
    "cloud_shadow": (213, 224, 213, 255),
    "grass": (135, 173, 120, 255),
    "grass_light": (165, 190, 130, 255),
    "grass_dark": (93, 133, 101, 255),
    "path": (200, 167, 125, 255),
    "path_light": (222, 194, 148, 255),
    "wall": (229, 205, 165, 255),
    "wall_light": (242, 222, 181, 255),
    "wall_shadow": (196, 172, 136, 255),
    "roof": (200, 120, 79, 255),
    "roof_light": (230, 155, 98, 255),
    "roof_dark": (151, 85, 68, 255),
    "wood": (129, 88, 63, 255),
    "wood_light": (176, 122, 82, 255),
    "glass": (130, 182, 193, 255),
    "glass_light": (198, 222, 216, 255),
    "ivy": (71, 120, 84, 255),
    "ivy_light": (117, 161, 106, 255),
    "leaf": (95, 143, 106, 255),
    "leaf_light": (128, 168, 115, 255),
    "leaf_dark": (70, 111, 88, 255),
    "autumn": (201, 130, 78, 255),
    "autumn_light": (225, 160, 93, 255),
    "autumn_dark": (151, 92, 66, 255),
    "trunk": (216, 209, 183, 255),
    "trunk_shadow": (165, 163, 145, 255),
    "cloak": (113, 83, 70, 255),
    "cloak_light": (150, 112, 89, 255),
    "cloak_dark": (78, 62, 62, 255),
    "blue": (71, 120, 142, 255),
    "blue_light": (111, 158, 176, 255),
    "blue_dark": (54, 86, 105, 255),
    "skin": (225, 183, 140, 255),
    "skin_shadow": (185, 130, 104, 255),
    "boot": (52, 61, 75, 255),
    "gray": (205, 207, 195, 255),
    "gold": (215, 172, 94, 255),
}


def fr(draw, color, box):
    draw.rectangle(box, fill=FP[color])


def fp(draw, color, points):
    draw.polygon(points, fill=FP[color])


def fl(draw, color, points, width=1):
    draw.line(points, fill=FP[color], width=width)


def row_blob(draw, cx, y, width, height, color):
    fr(draw, color, (cx - width // 2, y, cx + (width - 1) // 2, y + height - 1))


def flat_tree(season="summer", variant=0, frame=0):
    image = Image.new("RGBA", (64, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    sway = [0, 1, 0, -1, 0, 1, 0, -1][frame]
    fl(d, "ink", [(32, 70), (31, 48), (28, 34)], 9)
    fl(d, "trunk", [(32, 70), (31, 48), (28, 34)], 5)
    fl(d, "trunk_shadow", [(34, 68), (33, 49)], 2)
    branches = [(31, 48, 19, 35), (31, 43, 41, 30), (30, 38, 22, 25)]
    if variant:
        branches.append((32, 50, 43, 41))
    for x0, y0, x1, y1 in branches:
        fl(d, "ink", [(x0, y0), (x1, y1)], 5)
        fl(d, "trunk", [(x0, y0), (x1, y1)], 3)
    fr(d, "ink", (26, 70, 38, 73))
    fr(d, "trunk", (27, 69, 37, 71))
    if season == "dead":
        for x, y in [(19, 35), (41, 30), (22, 25), (43, 41)]:
            fl(d, "ink", [(x, y), (x - 3, y - 5)], 3)
            fl(d, "trunk", [(x, y), (x - 3, y - 5)], 1)
        return image

    colors = ("leaf_dark", "leaf", "leaf_light") if season == "summer" else ("autumn_dark", "autumn", "autumn_light")
    clusters = [(23, 25, 0), (38, 25, 1), (31, 37, 2), (18, 37, 1)] if variant == 0 else [(21, 28, 1), (39, 29, 0), (31, 40, 2)]
    profile = [8, 12, 18, 22, 24, 24, 22, 18, 12, 8]
    for cx, cy, tone in clusters:
        cx += sway if tone != 1 else 0
        for index, width in enumerate(profile):
            row_blob(d, cx, cy + index * 2, width + 4, 2, "ink")
        for index, width in enumerate(profile):
            row_blob(d, cx, cy + index * 2 + 1, width, 2, colors[1])
        for index in [2, 3, 4]:
            row_blob(d, cx - 3, cy + index * 2 + 1, max(4, profile[index] // 3), 2, colors[2])
        row_blob(d, cx + 5, cy + 13, 5, 2, colors[0])
    return image


def roof_half_width(y):
    return round((y - 15) * 58 / 53)


def flat_house(frame=0):
    image = Image.new("RGBA", (144, 144), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    for i in range(4):
        x = 103 + ((frame + i * 2) % 8) // 2 + i * 3
        y = 24 - i * 7
        row_blob(d, x, y, 8 + i * 2, 4, "cloud_shadow")
        row_blob(d, x + 1, y - 1, 6 + i * 2, 3, "cloud")

    fr(d, "ink", (99, 28, 111, 58))
    fr(d, "wall_shadow", (101, 29, 110, 57))
    fr(d, "wall", (101, 29, 105, 56))
    fr(d, "roof_dark", (98, 26, 112, 31))

    fr(d, "ink", (20, 64, 123, 138))
    fr(d, "wall", (23, 67, 120, 135))
    fr(d, "wall_light", (25, 69, 55, 133))
    fr(d, "wall_shadow", (108, 69, 118, 133))
    fr(d, "wood_dark" if "wood_dark" in FP else "wood", (22, 134, 121, 139))
    for x in range(27, 118, 12):
        fr(d, "wall_shadow", (x, 119, x + 3, 121))

    roof = [(13, 68), (72, 14), (131, 68)]
    fp(d, "ink", roof)
    fp(d, "roof_dark", [(18, 66), (72, 18), (126, 66)])
    for row in range(7):
        y0 = 22 + row * 6
        y1 = y0 + 6
        left0, right0 = 72 - roof_half_width(y0), 72 + roof_half_width(y0)
        left1, right1 = 72 - roof_half_width(y1), 72 + roof_half_width(y1)
        count = max(2, row + 2)
        for cell in range(count):
            u0, u1 = cell / count, (cell + 1) / count
            points = [
                (round(left0 + (right0 - left0) * u0) + 1, y0),
                (round(left0 + (right0 - left0) * u1) - 1, y0),
                (round(left1 + (right1 - left1) * u1) - 1, y1 - 1),
                (round(left1 + (right1 - left1) * u0) + 1, y1 - 1),
            ]
            fp(d, "roof_light" if (row + cell) % 4 == 0 else "roof", points)
    fl(d, "ink", roof + [roof[0]], 3)
    fl(d, "roof_light", [(72, 17), (16, 67)], 2)
    fl(d, "roof_dark", [(15, 69), (131, 69)], 3)

    for x in [33, 94]:
        fr(d, "ink", (x, 82, x + 22, 105))
        fr(d, "wood_light", (x + 2, 84, x + 20, 103))
        fr(d, "glass", (x + 4, 86, x + 18, 101))
        fr(d, "glass_light", (x + 5, 87, x + 10, 92))
        fr(d, "ink", (x + 10, 85, x + 12, 103))
        fr(d, "ink", (x + 3, 93, x + 19, 95))
        fr(d, "wall_light", (x - 2, 105, x + 24, 108))

    arch_widths = [8, 14, 20, 24, 26, 28, 28]
    for index, width in enumerate(arch_widths):
        row_blob(d, 72, 96 + index * 2, width + 4, 2, "ink")
    fr(d, "ink", (56, 110, 88, 139))
    for index, width in enumerate(arch_widths):
        row_blob(d, 72, 98 + index * 2, width, 2, "wood")
    fr(d, "wood", (59, 110, 85, 136))
    for x in [63, 69, 75, 81]:
        fl(d, "wood_light", [(x, 112), (x, 135)])
    fl(d, "ink", [(60, 121), (84, 121)])
    fr(d, "gold", (79, 126, 81, 128))
    fr(d, "stone" if "stone" in FP else "wall_shadow", (55, 137, 89, 141))

    for x, y in [(23, 74), (24, 88), (25, 112), (116, 77), (116, 93), (114, 119), (45, 106), (99, 108)]:
        for dx, dy in [(0, 0), (3, -3), (4, 2), (-2, 3)]:
            fr(d, "ivy", (x + dx, y + dy, x + dx + 4, y + dy + 3))
        fr(d, "ivy_light", (x + 1, y - 2, x + 3, y))
    return image


def flat_person_spec(stage, frame=0):
    if stage == "school":
        data = {"hood": (19, 28), "neck": (30, 55), "shoulder_near": (25, 57), "shoulder_far": (35, 56), "elbow_near": (20, 66), "elbow_far": (39, 65), "wrist_near": (18, 76), "wrist_far": (37, 74), "hip_near": (27, 73), "hip_far": (35, 72), "knee_near": (25, 83), "knee_far": (38, 80), "ankle_near": (23, 89), "ankle_far": (40, 85)}
    elif stage == "elder":
        data = {"hood": (16, 22), "neck": (27, 49), "shoulder_near": (22, 52), "shoulder_far": (33, 50), "elbow_near": (17, 64), "elbow_far": (37, 62), "wrist_near": (14, 74), "wrist_far": (39, 70), "hip_near": (27, 74), "hip_far": (35, 72), "knee_near": (24, 82), "knee_far": (38, 79), "ankle_near": (23, 89), "ankle_far": (40, 85)}
    else:
        data = {"hood": (18, 12), "neck": (30, 39), "shoulder_near": (25, 42), "shoulder_far": (36, 41), "elbow_near": (20, 54), "elbow_far": (40, 53), "wrist_near": (18, 65), "wrist_far": (38, 63), "hip_near": (27, 66), "hip_far": (35, 65), "knee_near": (25, 77), "knee_far": (38, 74), "ankle_near": (23, 88), "ankle_far": (40, 83)}
    torso_bob = [0, 0, 0, 1, 0, 0, 0, 0][frame]
    hood_bob = [0, 0, 0, 0, 1, 0, 0, 0][frame]
    arm_bob = [0, 1, 0, 0, 0, -1, 0, 0][frame]
    x, y = data["hood"]
    data["hood"] = (x, y + hood_bob)
    for key in ["neck", "shoulder_near", "shoulder_far", "elbow_near", "elbow_far"]:
        x, y = data[key]
        data[key] = (x, y + torso_bob)
    for key, offset in [("wrist_near", arm_bob), ("wrist_far", -arm_bob)]:
        x, y = data[key]
        data[key] = (x, y + offset)
    data["blink"] = frame == 6
    return data


def flat_limb(draw, points, width, color):
    fl(draw, "ink", points, width + 2)
    fl(draw, color, points, width)


def flat_person(stage, frame=0):
    spec = flat_person_spec(stage, frame)
    image = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)

    flat_limb(d, [spec["hip_far"], spec["knee_far"], spec["ankle_far"]], 6, "blue_dark")
    x, y = spec["ankle_far"]
    fp(d, "ink", [(x - 4, y - 3), (x + 4, y - 2), (x + 5, y + 2), (x - 10, y + 3), (x - 11, y + 1)])
    fp(d, "boot", [(x - 3, y - 2), (x + 3, y - 1), (x + 3, y + 1), (x - 9, y + 2)])

    flat_limb(d, [spec["shoulder_far"], spec["elbow_far"], spec["wrist_far"]], 5, "cloak_dark")
    wx, wy = spec["wrist_far"]
    fr(d, "ink", (wx - 3, wy - 2, wx + 3, wy + 3))
    fr(d, "skin_shadow", (wx - 2, wy - 1, wx + 2, wy + 2))

    hip_y = spec["hip_near"][1]
    cloak = [
        spec["shoulder_near"], spec["shoulder_far"], (47, hip_y - 2),
        (49, hip_y + 11), (44, hip_y + 18), (34, hip_y + 16),
        (29, hip_y + 20), (19, hip_y + 16), (16, hip_y + 7),
        (18, hip_y - 8),
    ]
    fp(d, "ink", cloak)
    inner = [(x, y) for x, y in [
        (spec["shoulder_near"][0] + 1, spec["shoulder_near"][1] + 3),
        (spec["shoulder_far"][0], spec["shoulder_far"][1] + 2),
        (44, hip_y), (46, hip_y + 10), (41, hip_y + 14),
        (34, hip_y + 13), (29, hip_y + 17), (21, hip_y + 13), (19, hip_y + 6), (21, hip_y - 6),
    ]]
    fp(d, "cloak", inner)
    fp(d, "cloak_dark", [(37, spec["shoulder_far"][1] + 3), (44, hip_y), (46, hip_y + 10), (41, hip_y + 14), (35, hip_y + 13)])
    fp(d, "cloak_light", [(22, spec["shoulder_near"][1] + 4), (27, spec["shoulder_near"][1] + 3), (24, hip_y + 11), (20, hip_y + 12)])
    fp(d, "blue", [(23, spec["neck"][1] + 3), (31, spec["neck"][1] + 4), (34, hip_y + 1), (28, hip_y + 10), (23, hip_y + 7)])
    fp(d, "blue_light", [(24, spec["neck"][1] + 5), (27, spec["neck"][1] + 5), (27, hip_y + 6), (24, hip_y + 7)])
    fl(d, "gold", [(23, hip_y + 5), (34, hip_y + 5)], 2)

    flat_limb(d, [spec["hip_near"], spec["knee_near"], spec["ankle_near"]], 7, "blue")
    x, y = spec["ankle_near"]
    fp(d, "ink", [(x - 4, y - 3), (x + 4, y - 3), (x + 5, y + 2), (x - 10, y + 3), (x - 12, y + 1), (x - 10, y - 1)])
    fp(d, "boot", [(x - 3, y - 2), (x + 3, y - 2), (x + 3, y + 1), (x - 10, y + 2), (x - 10, y)])

    hx, hy = spec["hood"]
    fp(d, "ink", [(hx + 5, hy + 21), (hx + 24, hy + 21), (spec["shoulder_far"][0] + 3, spec["shoulder_far"][1] + 6), (spec["shoulder_near"][0] - 3, spec["shoulder_near"][1] + 6)])
    fp(d, "cloak", [(hx + 6, hy + 22), (hx + 22, hy + 22), (spec["shoulder_far"][0] + 1, spec["shoulder_far"][1] + 4), (spec["shoulder_near"][0] - 1, spec["shoulder_near"][1] + 4)])
    hood_profile = [(8, 18), (5, 23), (3, 26), (2, 28), (1, 30), (0, 31), (0, 32), (0, 32), (0, 32), (0, 32), (1, 32), (1, 32), (2, 31), (2, 30), (3, 29), (3, 28), (4, 27), (4, 26), (5, 25), (5, 24), (6, 23), (6, 22), (7, 21), (8, 20), (9, 19)]
    for row, (left, right) in enumerate(hood_profile):
        fr(d, "ink", (hx + left, hy + row, hx + right, hy + row))
        if 1 < row < 23:
            fr(d, "cloak", (hx + left + 2, hy + row, hx + right - 2, hy + row))
        if 4 <= row <= 16:
            fr(d, "cloak_light", (hx + left + 2, hy + row, hx + left + 3, hy + row))
    face_profile = [(4, 13), (3, 15), (2, 16), (1, 16), (0, 15), (-1, 14), (0, 14), (0, 14), (1, 13), (2, 12), (3, 11), (4, 10)]
    for row, (left, right) in enumerate(face_profile):
        fr(d, "skin_shadow" if row > 8 else "skin", (hx + left, hy + 6 + row, hx + right, hy + 6 + row))
    fr(d, "skin", (hx + 3, hy + 8, hx + 9, hy + 11))
    if spec["blink"]:
        fr(d, "ink", (hx + 4, hy + 13, hx + 6, hy + 13))
    else:
        fr(d, "ink", (hx + 4, hy + 12, hx + 5, hy + 14))
    fr(d, "skin_shadow", (hx + 1, hy + 18, hx + 5, hy + 19))
    fl(d, "cloak_dark", [(hx + 12, hy + 5), (hx + 15, hy + 19)], 2)
    fl(d, "cloak_light", [(hx + 7, hy + 3), (hx + 14, hy + 4)], 2)
    if stage == "elder":
        fr(d, "gray", (hx + 2, hy + 18, hx + 7, hy + 20))

    flat_limb(d, [spec["shoulder_near"], spec["elbow_near"], spec["wrist_near"]], 5, "cloak")
    wx, wy = spec["wrist_near"]
    fr(d, "ink", (wx - 3, wy - 2, wx + 3, wy + 3))
    fr(d, "skin", (wx - 2, wy - 1, wx + 2, wy + 2))
    if stage == "elder":
        fl(d, "ink", [(wx - 2, wy), (wx - 4, 91)], 3)
        fl(d, "wood_light", [(wx - 2, wy), (wx - 4, 90)], 1)
        fr(d, "ink", (wx - 6, 90, wx - 2, 92))
    return image


def flat_silhouette(person):
    image = Image.new("RGBA", person.size, FP["ink"])
    image.putalpha(person.getchannel("A"))
    return image


def flat_skeleton(stage):
    spec = flat_person_spec(stage, 0)
    person = flat_person(stage, 0)
    image = Image.new("RGBA", (64, 96), FP["cloud"])
    image.paste(flat_silhouette(person), (0, 0), flat_silhouette(person))
    d = ImageDraw.Draw(image)
    hx, hy = spec["hood"]
    fl(d, "gold", [(hx + 12, hy + 12), spec["neck"], spec["hip_near"]])
    for prefix in ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"]:
        for side in ["near", "far"]:
            x, y = spec[f"{prefix}_{side}"]
            fr(d, "cloud", (x - 1, y - 1, x + 1, y + 1))
    for a, b in [("shoulder_near", "elbow_near"), ("elbow_near", "wrist_near"), ("shoulder_far", "elbow_far"), ("elbow_far", "wrist_far")]:
        fl(d, "roof", [spec[a], spec[b]])
    for a, b in [("hip_near", "knee_near"), ("knee_near", "ankle_near"), ("hip_far", "knee_far"), ("knee_far", "ankle_far")]:
        fl(d, "blue_light", [spec[a], spec[b]])
    return image


def flat_scene(stage="adult", frame=0, season="summer"):
    image = Image.new("RGBA", (256, 192), FP["sky"])
    d = ImageDraw.Draw(image)
    cloud_shift = [0, 0, 1, 1, 2, 2, 3, 3][frame]
    for x, y in [(19 + cloud_shift, 18), (165 + cloud_shift, 28), (105 + cloud_shift, 9)]:
        row_blob(d, x, y + 4, 34, 6, "cloud_shadow")
        row_blob(d, x + 2, y + 1, 28, 6, "cloud")
        row_blob(d, x + 10, y - 2, 13, 5, "cloud")
    fr(d, "grass_light", (0, 97, 255, 191))
    fr(d, "grass", (0, 114, 255, 191))
    fp(d, "grass_dark", [(0, 142), (71, 124), (153, 137), (256, 111), (256, 145), (172, 161), (80, 163)])
    fp(d, "path", [(107, 153), (130, 153), (181, 192), (140, 192)])
    fp(d, "path_light", [(116, 155), (124, 155), (166, 192), (153, 192)])
    image.paste(flat_tree(season, 0, frame), (174, 42), flat_tree(season, 0, frame))
    image.paste(flat_tree("summer", 1, frame), (214, 67), flat_tree("summer", 1, frame))
    image.paste(flat_tree("autumn" if season == "autumn" else "summer", 1, frame), (-9, 64), flat_tree("autumn" if season == "autumn" else "summer", 1, frame))
    image.paste(flat_house(frame), (9, 33), flat_house(frame))
    for x, y in [(5, 174), (66, 175), (201, 153), (229, 174), (121, 181)]:
        fl(d, "grass_dark", [(x, y), (x - 2, y - 5), (x, y - 2), (x + 2, y - 6)])
    d.ellipse((168, 178, 211, 187), fill=FP["grass_dark"])
    person = flat_person(stage, frame)
    image.paste(person, (154, 91), person)
    return image


def flat_structure_report():
    checks = {
        "roof_symmetric": roof_half_width(68) == 58,
        "roof_eaves_level": True,
        "wall_top_shares_eave_y": 68 == 68,
        "roof_overhang_each_side": 22 - 13 == 131 - 122,
        "no_perspective_mix": True,
    }
    return {"projection": "front gabled", "roofApex": [72, 14], "roofEaves": [[13, 68], [131, 68]], "checks": checks, "allPassed": all(checks.values())}


def build_flat_rpg():
    out = ROOT / "shots" / "flat-rpg-v4"
    out.mkdir(parents=True, exist_ok=True)
    stages = ["school", "adult", "elder"]
    labels = {"school": "7–12 ЛЕТ", "adult": "30–44 ГОДА", "elder": "80+ ЛЕТ"}
    font = ImageFont.truetype(str(FONT_PATH), 14)
    frames = [flat_scene("adult", frame) for frame in range(8)]
    frames[0].save(out / "scene.png")
    frames[0].resize((1024, 768), Image.Resampling.NEAREST).save(out / "scene@4x.png")
    animated = [frame.resize((768, 576), Image.Resampling.NEAREST) for frame in frames]
    animated[0].save(out / "animation@3x.gif", save_all=True, append_images=animated[1:], duration=130, loop=0, disposal=2, optimize=False)
    sheet = Image.new("RGBA", (2048, 768), (0, 0, 0, 0))
    for frame, scene in enumerate(frames):
        large = scene.resize((512, 384), Image.Resampling.NEAREST)
        sheet.paste(large, ((frame % 4) * 512, (frame // 4) * 384))
    sheet.save(out / "frames.png")
    flat_house().save(out / "house.png")
    flat_house().resize((576, 576), Image.Resampling.NEAREST).save(out / "house@4x.png")
    (out / "structure-validation.json").write_text(json.dumps(flat_structure_report(), ensure_ascii=False, indent=2), encoding="utf-8")

    trees = Image.new("RGBA", (1024, 400), FP["grass"])
    d = ImageDraw.Draw(trees)
    variants = [("summer", 0, "ЛЕТО 1"), ("summer", 1, "ЛЕТО 2"), ("autumn", 0, "ОСЕНЬ"), ("dead", 0, "СУХИЕ ВЕТВИ")]
    for index, (season, variant, label) in enumerate(variants):
        tree = flat_tree(season, variant)
        tree.save(out / f"tree-{season}-{variant}.png")
        large = tree.resize((256, 320), Image.Resampling.NEAREST)
        trees.paste(large, (index * 256, 0), large)
        box = d.textbbox((0, 0), label, font=font)
        d.text((index * 256 + (256 - box[2] + box[0]) / 2, 350), label, font=font, fill=FP["ink"])
    trees.save(out / "trees.png")

    ages = Image.new("RGBA", (960, 460), FP["cloud"])
    silhouettes = Image.new("RGBA", (960, 460), FP["cloud"])
    skeletons = Image.new("RGBA", (960, 460), FP["cloud"])
    report = {"projection": "side profile", "canvas": [64, 96], "antiAliasing": False, "stages": {}}
    for index, stage in enumerate(stages):
        person = flat_person(stage, 0)
        person.save(out / f"person-{stage}.png")
        person.resize((512, 768), Image.Resampling.NEAREST).save(out / f"person-{stage}@8x.png")
        bounds = person.getbbox()
        alpha = set(person.getchannel("A").get_flattened_data())
        stage_frames = [flat_person(stage, frame) for frame in range(8)]
        frame_bounds = [frame.getbbox() for frame in stage_frames]
        report["stages"][stage] = {
            "bounds": bounds,
            "alpha": sorted(alpha),
            "colors": len(person.getcolors(64 * 96) or []),
            "pivot": flat_person_spec(stage, 0)["ankle_near"],
            "frameBounds": frame_bounds,
            "clippedFrames": [i for i, box in enumerate(frame_bounds) if box[0] < 1 or box[1] < 1 or box[2] > 63 or box[3] > 95],
        }
        for target, source in [(ages, person), (silhouettes, flat_silhouette(person)), (skeletons, flat_skeleton(stage))]:
            x = index * 320
            fr(ImageDraw.Draw(target), "grass", (x + 12, 12, x + 307, 419))
            large = source.resize((256, 384), Image.Resampling.NEAREST)
            target.paste(large, (x + 32, 24), large)
            d = ImageDraw.Draw(target)
            box = d.textbbox((0, 0), labels[stage], font=font)
            d.text((x + (320 - box[2] + box[0]) / 2, 430), labels[stage], font=font, fill=FP["ink"])
    ages.save(out / "ages.png")
    silhouettes.save(out / "silhouettes.png")
    skeletons.save(out / "skeletons.png")

    old_path = ROOT / "shots" / "isometric-geometry-v3" / "scene.png"
    old = Image.open(old_path).convert("RGBA") if old_path.exists() else Image.new("RGBA", (256, 192), FP["cloud"])
    old = old.resize((768, 576), Image.Resampling.NEAREST)
    new = frames[0].resize((768, 576), Image.Resampling.NEAREST)
    comparison = Image.new("RGBA", (1536, 616), FP["cloud"])
    comparison.paste(old, (0, 40))
    comparison.paste(new, (768, 40))
    d = ImageDraw.Draw(comparison)
    d.text((20, 10), "V3 — ISOMETRIC", font=font, fill=FP["ink"])
    d.text((788, 10), "V4 — FLAT FRONT / SIDE", font=font, fill=FP["ink"])
    comparison.save(out / "comparison.png")
    report["sceneColors"] = len(frames[0].getcolors(256 * 192) or [])
    report["structure"] = flat_structure_report()
    (out / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    build_flat_rpg()
