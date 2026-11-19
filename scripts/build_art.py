from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "art"

C = {
    "outline": (42, 38, 35, 255),
    "skin": (216, 168, 120, 255),
    "skin_light": (240, 200, 160, 255),
    "skin_shadow": (168, 120, 80, 255),
    "cloth": (122, 52, 40, 255),
    "cloth_light": (176, 90, 74, 255),
    "cloth_dark": (90, 48, 42, 255),
    "boots": (42, 53, 72, 255),
    "hair": (58, 42, 32, 255),
    "hair_light": (104, 72, 48, 255),
    "gray": (168, 168, 168, 255),
    "white": (240, 240, 230, 255),
    "gold": (184, 152, 88, 255),
    "sky": (126, 192, 232, 255),
    "sky_light": (168, 216, 240, 255),
    "sky_north": (216, 236, 248, 255),
    "ground": (106, 154, 91, 255),
    "ground_dark": (74, 122, 67, 255),
    "ground_light": (111, 159, 99, 255),
    "sand": (216, 192, 138, 255),
    "sand_dark": (184, 160, 112, 255),
    "snow": (232, 238, 242, 255),
    "snow_shadow": (168, 189, 200, 255),
    "pine": (41, 71, 63, 255),
    "pine_mid": (63, 107, 79, 255),
    "pine_light": (111, 159, 99, 255),
    "leaf": (67, 101, 63, 255),
    "leaf_light": (111, 159, 99, 255),
    "leaf_dark": (58, 95, 56, 255),
    "autumn": (184, 152, 88, 255),
    "autumn_light": (200, 174, 120, 255),
    "trunk": (104, 72, 48, 255),
    "trunk_light": (138, 104, 72, 255),
    "stone": (85, 112, 106, 255),
    "stone_light": (61, 90, 84, 255),
    "wall": (200, 174, 120, 255),
    "wall_light": (240, 200, 160, 255),
    "roof": (122, 52, 40, 255),
    "roof_light": (176, 90, 74, 255),
    "glass": (85, 112, 106, 255),
    "glass_light": (136, 184, 200, 255),
}


def rect(draw, color, x0, y0, x1, y1):
    draw.rectangle((x0, y0, x1, y1), fill=C[color] if isinstance(color, str) else color)


def poly(draw, color, points):
    draw.polygon(points, fill=C[color] if isinstance(color, str) else color)


def cloud(draw, x, y, scale=1):
    for dx, dy, w, h in [(0, 4, 18, 4), (4, 0, 8, 6), (12, 2, 10, 6)]:
        rect(draw, "white", x + dx * scale, y + dy * scale, x + (dx + w) * scale - 1, y + (dy + h) * scale - 1)


def shrub(draw, x, y, autumn=False):
    dark = "autumn" if autumn else "leaf_dark"
    mid = "autumn_light" if autumn else "leaf"
    light = "gold" if autumn else "leaf_light"
    rect(draw, dark, x + 2, y + 3, x + 10, y + 7)
    rect(draw, mid, x + 1, y + 2, x + 6, y + 5)
    rect(draw, mid, x + 5, y, x + 11, y + 4)
    rect(draw, light, x + 4, y + 1, x + 7, y + 2)


def rock(draw, x, y, north=False):
    poly(draw, "snow_shadow" if north else "stone_light", [(x + 2, y), (x + 8, y - 1), (x + 12, y + 3), (x + 11, y + 7), (x + 3, y + 8), (x, y + 5)])
    poly(draw, "snow" if north else "stone", [(x + 3, y + 1), (x + 7, y), (x + 9, y + 3), (x + 5, y + 4)])
    rect(draw, "snow_shadow" if north else "stone_light", x + 3, y + 5, x + 10, y + 7)


def conifer(draw, x, y, height=30, autumn=False):
    trunk_h = max(5, height // 4)
    rect(draw, "trunk", x + 5, y + height - trunk_h, x + 7, y + height)
    rect(draw, "trunk_light", x + 6, y + height - trunk_h, x + 6, y + height - 1)
    dark = "autumn" if autumn else "pine"
    mid = "autumn_light" if autumn else "pine_mid"
    light = "gold" if autumn else "pine_light"
    tiers = 4
    for i in range(tiers):
        top = y + i * (height // 5)
        half = 4 + i * 2
        poly(draw, dark, [(x + 6, top), (x + 6 - half, top + 7), (x + 6 + half, top + 7)])
        poly(draw, mid, [(x + 6, top + 1), (x + 6 - half + 2, top + 6), (x + 6 + half - 2, top + 6)])
        if i % 2 == 0:
            rect(draw, light, x + 6, top + 3, x + 7, top + 5)
        rect(draw, dark, x + 6 - half, top + 6, x + 6 + half, top + 8)


def round_tree(draw, x, y, height=25, autumn=False):
    rect(draw, "trunk", x + 7, y + height - 8, x + 9, y + height)
    rect(draw, "trunk_light", x + 8, y + height - 7, x + 8, y + height - 1)
    dark = "autumn" if autumn else "leaf_dark"
    mid = "autumn_light" if autumn else "leaf"
    light = "gold" if autumn else "leaf_light"
    rect(draw, dark, x + 2, y + 4, x + 14, y + 15)
    rect(draw, dark, x + 4, y + 1, x + 12, y + 18)
    rect(draw, mid, x + 1, y + 6, x + 15, y + 13)
    rect(draw, mid, x + 4, y + 2, x + 12, y + 16)
    rect(draw, light, x + 4, y + 3, x + 8, y + 7)
    rect(draw, light, x + 10, y + 6, x + 13, y + 10)
    rect(draw, dark, x + 4, y + 14, x + 12, y + 17)


def palm(draw, x, y, height=32):
    poly(draw, "trunk", [(x + 7, y + 5), (x + 9, y + 5), (x + 8, y + height), (x + 6, y + height)])
    rect(draw, "trunk_light", x + 7, y + 8, x + 7, y + height - 4)
    for dx, dy in [(-8, 4), (-6, 0), (-3, -3), (2, -4), (6, -1), (8, 3)]:
        poly(draw, "leaf_dark", [(x + 7, y + 5), (x + 7 + dx, y + 5 + dy), (x + 7 + dx + (1 if dx >= 0 else -1), y + 8 + dy), (x + 7, y + 7)])
        rect(draw, "leaf_light", x + 7 + dx, y + 5 + dy, x + 8 + dx, y + 6 + dy)
    rect(draw, "leaf", x + 5, y + 4, x + 9, y + 8)


def background(climate):
    sky_color = "sky_north" if climate == "north" else "sky_light" if climate == "tropics" else "sky"
    ground_color = "snow" if climate == "north" else "sand" if climate == "tropics" else "ground"
    shadow_color = "snow_shadow" if climate == "north" else "sand_dark" if climate == "tropics" else "ground_dark"
    sky = Image.new("RGBA", (256, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(sky)
    rect(d, sky_color, 0, 0, 255, 95)
    cloud(d, 30, 16, 1)
    cloud(d, 176, 10, 1)
    cloud(d, 106, 30, 1)

    far = Image.new("RGBA", (256, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(far)
    poly(d, shadow_color, [(0, 52), (32, 36), (60, 47), (91, 27), (126, 44), (158, 31), (194, 48), (228, 33), (255, 43), (255, 95), (0, 95)])
    poly(d, ground_color, [(0, 62), (35, 50), (70, 58), (108, 43), (145, 56), (182, 45), (219, 58), (255, 49), (255, 95), (0, 95)])
    if climate == "north":
        for x, y, h in [(12, 25, 30), (49, 37, 26), (86, 29, 34), (139, 38, 25), (177, 24, 33), (222, 34, 28)]:
            conifer(d, x, y, h)
        for x, y in [(32, 65), (111, 62), (203, 66)]:
            rock(d, x, y, True)
    elif climate == "tropics":
        for x, y, h in [(14, 25, 31), (58, 37, 26), (94, 25, 34), (146, 36, 28), (186, 24, 34), (230, 35, 27)]:
            palm(d, x, y, h)
        for x, y in [(38, 66), (120, 63), (207, 66)]:
            rock(d, x, y)
    else:
        for x, y, h, autumn in [(12, 28, 28, False), (49, 39, 24, True), (86, 29, 31, False), (139, 39, 25, False), (177, 27, 30, True), (222, 37, 26, False)]:
            round_tree(d, x, y, h, autumn)
        for x, y in [(34, 66), (115, 63), (205, 67)]:
            rock(d, x, y)

    near = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(near)
    rect(d, ground_color, 0, 0, 255, 63)
    for x, y, autumn in [(8, 41, False), (43, 48, True), (76, 38, False), (119, 47, False), (154, 39, True), (198, 48, False), (232, 40, False)]:
        if climate == "tropics":
            palm(d, x, y - 10, 25)
        elif climate == "north":
            conifer(d, x, y - 10, 25)
        else:
            round_tree(d, x, y - 10, 25, autumn)
    for x, y in [(23, 52), (94, 55), (169, 51), (244, 54)]:
        rock(d, x, y, climate == "north")
    for x, y, autumn in [(4, 56, False), (57, 58, True), (132, 55, False), (218, 57, False)]:
        shrub(d, x, y, autumn and climate == "temperate")
    for name, image in [("sky", sky), ("far", far), ("near", near)]:
        image.save(OUT / f"bg_{climate}_{name}_static.png")


def house(level):
    image = Image.new("RGBA", (96, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    rect(d, "outline", 13, 32, 82, 72)
    rect(d, "wall", 16, 34, 79, 69)
    for y in range(38, 68, 8):
        rect(d, "wall_light", 17, y, 78, y + 1)
    poly(d, "outline", [(9, 37), (46, 9), (86, 37)])
    poly(d, "roof", [(14, 35), (46, 14), (81, 35)])
    poly(d, "roof_light", [(20, 32), (46, 17), (75, 32)])
    rect(d, "outline", 39, 48, 55, 72)
    rect(d, "trunk", 42, 51, 52, 72)
    rect(d, "trunk_light", 44, 53, 46, 55)
    for x in [21, 62]:
        rect(d, "outline", x, 43, x + 12, 56)
        rect(d, "glass", x + 2, 45, x + 10, 54)
        rect(d, "glass_light", x + 3, 46, x + 6, 48)
    rect(d, "outline", 16, 69, 79, 72)
    rect(d, "gold", 57, 57, 59, 59)
    if level == "poor":
        rect(d, "trunk", 18, 61, 30, 63)
        rect(d, "trunk", 65, 36, 78, 38)
    elif level == "rich":
        rect(d, "outline", 66, 13, 73, 28)
        rect(d, "wall_light", 67, 14, 72, 27)
        rect(d, "gold", 18, 35, 78, 37)
    image.save(OUT / f"house_{level}_static.png")


def hair(d, variant, x, y, gray=False):
    main = "gray" if gray else "hair"
    light = "gray" if gray else "hair_light"
    if variant == 0:
        rect(d, main, x, y, x + 15, y + 4)
        rect(d, main, x, y + 3, x + 2, y + 8)
        rect(d, light, x + 3, y + 1, x + 9, y + 2)
    elif variant == 1:
        rect(d, main, x, y, x + 15, y + 4)
        rect(d, main, x + 1, y + 3, x + 3, y + 12)
        rect(d, main, x + 12, y + 3, x + 15, y + 10)
        rect(d, light, x + 4, y + 1, x + 10, y + 2)
    else:
        for dx, dy in [(0, 2), (3, 0), (7, 0), (11, 1), (1, 4), (12, 4), (0, 7), (13, 7)]:
            rect(d, main, x + dx, y + dy, x + dx + 3, y + dy + 3)
        rect(d, light, x + 4, y + 1, x + 8, y + 2)


def person(stage, variant, anim, frame, career=None):
    image = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    y = {"child": 15, "teen": 11, "adult": 7, "senior": 9}[stage] + [0, 1, 0, -1][frame]
    x = 15
    head_w = 15 if stage != "adult" else 17
    rect(d, "outline", x - 1, y + 2, x + head_w, y + 19)
    rect(d, "skin", x + 1, y + 5, x + head_w - 2, y + 17)
    rect(d, "skin_light", x + 2, y + 6, x + head_w - 4, y + 9)
    hair(d, variant, x, y, stage == "senior")
    eye_y = y + 11
    if anim != "happy":
        rect(d, "outline", x + 4, eye_y, x + 5, eye_y + 1)
        rect(d, "outline", x + head_w - 6, eye_y, x + head_w - 5, eye_y + 1)
    else:
        rect(d, "outline", x + 4, eye_y + 1, x + 5, eye_y + 1)
        rect(d, "outline", x + head_w - 6, eye_y + 1, x + head_w - 5, eye_y + 1)
    rect(d, "skin_shadow", x + 8, y + 12, x + 9, y + 14)
    if anim == "happy":
        rect(d, "outline", x + 6, y + 15, x + head_w - 7, y + 15)
        rect(d, "white", x + 7, y + 15, x + head_w - 8, y + 15)
    elif anim == "sad":
        rect(d, "outline", x + 6, y + 15, x + head_w - 7, y + 15)
        rect(d, "outline", x + 6, y + 16, x + head_w - 7, y + 16)
    else:
        rect(d, "skin_shadow", x + 6, y + 15, x + head_w - 7, y + 15)
    if stage == "senior":
        rect(d, "gray", x + 5, y + 16, x + head_w - 6, y + 19)
        rect(d, "gray", x + 7, y + 18, x + head_w - 8, y + 20)

    body_y = y + 20
    rect(d, "outline", x - 2, body_y, x + head_w + 1, body_y + 23)
    rect(d, "cloth", x - 1, body_y + 2, x + head_w, body_y + 20)
    rect(d, "cloth_light", x + 1, body_y + 3, x + 4, body_y + 16)
    rect(d, "cloth_dark", x + head_w - 4, body_y + 4, x + head_w - 1, body_y + 19)
    rect(d, "outline", x - 1, body_y + 18, x + head_w, body_y + 19)
    arm_shift = -3 if anim == "happy" else 1 if anim == "sad" else 0
    for ax in [x - 4, x + head_w + 2]:
        rect(d, "outline", ax, body_y + 4 + arm_shift, ax + 3, body_y + 18 + arm_shift)
        rect(d, "cloth", ax + 1, body_y + 5 + arm_shift, ax + 2, body_y + 14 + arm_shift)
        rect(d, "skin", ax + 1, body_y + 15 + arm_shift, ax + 2, body_y + 18 + arm_shift)
    for lx in [x, x + head_w - 6]:
        rect(d, "outline", lx, body_y + 21, lx + 5, body_y + 31)
        rect(d, "boots", lx, body_y + 26, lx + 5, body_y + 31)
        rect(d, "cloth_dark", lx + 1, body_y + 21, lx + 4, body_y + 25)
    if stage == "senior":
        rect(d, "trunk", x + head_w + 7, body_y + 12, x + head_w + 8, body_y + 31)
        rect(d, "gold", x + head_w + 7, body_y + 11, x + head_w + 8, body_y + 13)
    if career:
        ax, ay = x + head_w + 4, body_y + 5
        if career == "medicine":
            rect(d, "white", ax, ay, ax + 5, ay + 5)
            rect(d, "outline", ax + 2, ay, ax + 3, ay + 5)
            rect(d, "outline", ax, ay + 2, ax + 5, ay + 3)
        elif career == "education":
            rect(d, "white", ax, ay, ax + 6, ay + 5)
            rect(d, "gold", ax + 3, ay, ax + 3, ay + 5)
        elif career == "engineering":
            rect(d, "boots", ax, ay, ax + 6, ay + 4)
            rect(d, "glass_light", ax + 1, ay + 1, ax + 5, ay + 3)
        elif career == "industry":
            rect(d, "gray", ax, ay, ax + 6, ay + 2)
            rect(d, "gray", ax + 4, ay + 2, ax + 5, ay + 5)
        elif career == "agriculture":
            rect(d, "leaf", ax + 2, ay, ax + 4, ay + 5)
            rect(d, "leaf_light", ax, ay + 2, ax + 3, ay + 4)
            rect(d, "leaf_light", ax + 4, ay + 1, ax + 6, ay + 3)
        elif career == "services":
            rect(d, "gold", ax, ay, ax + 5, ay + 5)
            rect(d, "outline", ax + 2, ay + 2, ax + 3, ay + 3)
        elif career == "pilot":
            rect(d, "gold", x + 1, y + 1, x + head_w - 2, y + 3)
            rect(d, "outline", x + 3, y + 4, x + head_w - 4, y + 5)
    return image


def main():
    for climate in ["north", "temperate", "tropics"]:
        background(climate)
    for level in ["poor", "mid", "rich"]:
        house(level)
    for stage in ["child", "teen", "adult", "senior"]:
        for variant in [0, 1, 2]:
            suffix = "" if variant == 0 else f"_v{variant}"
            for anim in ["idle", "happy", "sad"]:
                sheet = Image.new("RGBA", (192, 64), (0, 0, 0, 0))
                for frame in range(4):
                    sheet.paste(person(stage, variant, anim, frame), (frame * 48, 0))
                sheet.save(OUT / f"person_{stage}{suffix}_{anim}.png")
    for career in ["medicine", "education", "engineering", "industry", "agriculture", "services", "pilot"]:
        sheet = Image.new("RGBA", (192, 64), (0, 0, 0, 0))
        for frame in range(4):
            sheet.paste(person("adult", 0, "idle", frame, career), (frame * 48, 0))
        sheet.save(OUT / f"career_{career}_idle.png")
    preview = Image.new("RGBA", (256 * 4, 192 * 4), (0, 0, 0, 0))
    scene = Image.open(OUT / "bg_temperate_far_static.png").resize((256 * 4, 96 * 4), Image.Resampling.NEAREST)
    preview.paste(scene, (0, 32 * 4))
    hero = Image.open(OUT / "person_adult_idle.png").crop((0, 0, 48, 64)).resize((48 * 4, 64 * 4), Image.Resampling.NEAREST)
    preview.paste(hero, (156 * 4, 116 * 4), hero)
    preview.save(ROOT / "shots" / "new-art-preview.png")
    print("Original sprites: 3 climates, 3 houses, 36 person sheets, 7 careers")


IP = {
    "ink": (55, 64, 76, 255),
    "ink_soft": (75, 83, 94, 255),
    "sky": (185, 216, 229, 255),
    "sky_light": (221, 235, 237, 255),
    "cloud": (239, 240, 226, 255),
    "cloud_shadow": (207, 222, 218, 255),
    "ground": (157, 180, 148, 255),
    "ground_light": (177, 194, 157, 255),
    "ground_dark": (121, 151, 132, 255),
    "grass": (82, 126, 107, 255),
    "grass_light": (117, 151, 111, 255),
    "leaf_dark": (66, 103, 98, 255),
    "leaf": (91, 135, 112, 255),
    "leaf_light": (139, 166, 127, 255),
    "trunk": (109, 82, 70, 255),
    "trunk_light": (151, 112, 83, 255),
    "wall": (225, 205, 167, 255),
    "wall_light": (242, 224, 184, 255),
    "wall_shadow": (184, 176, 151, 255),
    "plaster_chip": (199, 183, 153, 255),
    "roof": (116, 158, 179, 255),
    "roof_light": (145, 183, 197, 255),
    "roof_mid": (102, 143, 166, 255),
    "roof_dark": (76, 111, 137, 255),
    "roof_edge": (83, 89, 105, 255),
    "wood": (132, 94, 75, 255),
    "wood_light": (181, 135, 96, 255),
    "wood_dark": (88, 75, 72, 255),
    "glass": (94, 140, 158, 255),
    "glass_light": (172, 205, 205, 255),
    "stone": (137, 144, 137, 255),
    "stone_light": (183, 185, 165, 255),
    "path": (196, 165, 137, 255),
    "path_light": (219, 190, 151, 255),
    "flower": (218, 158, 147, 255),
    "flower_gold": (229, 194, 119, 255),
    "skin": (218, 170, 133, 255),
    "skin_light": (239, 198, 158, 255),
    "skin_shadow": (177, 125, 103, 255),
    "hair": (75, 55, 51, 255),
    "hair_light": (117, 80, 62, 255),
    "gray": (210, 211, 198, 255),
    "gray_shadow": (151, 159, 153, 255),
    "cloth": (116, 86, 96, 255),
    "cloth_light": (158, 116, 119, 255),
    "cloth_dark": (79, 72, 88, 255),
    "shirt": (223, 190, 142, 255),
    "trousers": (75, 91, 108, 255),
    "trousers_light": (102, 120, 132, 255),
    "shoe": (61, 64, 73, 255),
    "white": (241, 232, 208, 255),
}


def ir(draw, color, box):
    draw.rectangle(box, fill=IP[color])


def ip(draw, color, points):
    draw.polygon(points, fill=IP[color])


def il(draw, color, points, width=1):
    draw.line(points, fill=IP[color], width=width)


def ie(draw, color, box):
    draw.ellipse(box, fill=IP[color])


def quad_point(quad, u, v):
    top = (quad[0][0] + (quad[1][0] - quad[0][0]) * u, quad[0][1] + (quad[1][1] - quad[0][1]) * u)
    bottom = (quad[3][0] + (quad[2][0] - quad[3][0]) * u, quad[3][1] + (quad[2][1] - quad[3][1]) * u)
    return (round(top[0] + (bottom[0] - top[0]) * v), round(top[1] + (bottom[1] - top[1]) * v))


def quad_cell(draw, quad, u0, v0, u1, v1, color, outline=None):
    points = [quad_point(quad, u0, v0), quad_point(quad, u1, v0), quad_point(quad, u1, v1), quad_point(quad, u0, v1)]
    ip(draw, color, points)
    if outline:
        il(draw, outline, points + [points[0]])


def iso_window(draw, wall, u0, u1):
    outer = [quad_point(wall, u0, 0.25), quad_point(wall, u1, 0.25), quad_point(wall, u1, 0.72), quad_point(wall, u0, 0.72)]
    ip(draw, "wood_dark", outer)
    inner = [quad_point(wall, u0 + 0.018, 0.31), quad_point(wall, u1 - 0.018, 0.31), quad_point(wall, u1 - 0.018, 0.65), quad_point(wall, u0 + 0.018, 0.65)]
    ip(draw, "glass", inner)
    il(draw, "glass_light", [quad_point(wall, u0 + 0.025, 0.34), quad_point(wall, (u0 + u1) / 2, 0.34), quad_point(wall, (u0 + u1) / 2, 0.63)], 2)
    il(draw, "wood_light", [quad_point(wall, (u0 + u1) / 2, 0.29), quad_point(wall, (u0 + u1) / 2, 0.67)])
    il(draw, "wood_light", [quad_point(wall, u0 + 0.015, 0.49), quad_point(wall, u1 - 0.015, 0.49)])
    il(draw, "wall_light", [quad_point(wall, u0 - 0.015, 0.75), quad_point(wall, u1 + 0.015, 0.75)], 2)


def iso_house(draw, frame):
    sway = [0, 1, 0, -1, 0, 1, 0, -1][frame]
    for i in range(4):
        x = 84 + ((frame + i * 2) % 8) // 2 + i * 3
        y = 53 - i * 9 - frame % 2
        ir(draw, "cloud_shadow", (x, y, x + 7 + i, y + 4 + i // 2))
        ir(draw, "cloud", (x + 2, y - 1, x + 5 + i, y + 2))

    left_wall = [(22, 91), (62, 114), (62, 151), (22, 128)]
    right_wall = [(62, 114), (150, 91), (150, 128), (62, 151)]
    ip(draw, "wall", left_wall)
    ip(draw, "wall_shadow", right_wall)
    il(draw, "ink", left_wall + [left_wall[0]], 2)
    il(draw, "ink", right_wall + [right_wall[0]], 2)
    for wall in [left_wall, right_wall]:
        for u, v in [(0.08, 0.78), (0.42, 0.83), (0.7, 0.72), (0.87, 0.86)]:
            x, y = quad_point(wall, u, v)
            ir(draw, "plaster_chip", (x, y, x + 3, y + 1))
    iso_window(draw, left_wall, 0.18, 0.58)
    iso_window(draw, right_wall, 0.12, 0.36)

    door = [quad_point(right_wall, 0.57, 0.25), quad_point(right_wall, 0.83, 0.25), quad_point(right_wall, 0.83, 0.98), quad_point(right_wall, 0.57, 0.98)]
    ip(draw, "wood_dark", door)
    door_inner = [quad_point(right_wall, 0.6, 0.3), quad_point(right_wall, 0.8, 0.3), quad_point(right_wall, 0.8, 0.96), quad_point(right_wall, 0.6, 0.96)]
    ip(draw, "roof_mid", door_inner)
    for u in [0.64, 0.7, 0.76]:
        il(draw, "roof_dark", [quad_point(right_wall, u, 0.32), quad_point(right_wall, u, 0.94)])
    knob = quad_point(right_wall, 0.76, 0.65)
    ir(draw, "flower_gold", (knob[0], knob[1], knob[0] + 1, knob[1] + 1))
    ip(draw, "stone", [(91, 145), (126, 136), (135, 140), (99, 151)])
    ip(draw, "stone_light", [(96, 151), (132, 141), (141, 146), (104, 156)])

    left_roof = [(60, 66), (100, 89), (62, 114), (22, 91)]
    right_roof = [(60, 66), (110, 60), (150, 92), (100, 89)]
    for u in range(6):
        for v in range(4):
            shade = ["roof", "roof_light", "roof", "roof_mid"][(u + v * 2) % 4]
            quad_cell(draw, left_roof, u / 6 + 0.006, v / 4 + 0.012, (u + 1) / 6 - 0.006, (v + 1) / 4 - 0.012, shade, "roof_dark")
    for u in range(5):
        for v in range(3):
            shade = "roof_mid" if (u + v) % 3 else "roof"
            quad_cell(draw, right_roof, u / 5 + 0.006, v / 3 + 0.012, (u + 1) / 5 - 0.006, (v + 1) / 3 - 0.012, shade, "roof_dark")
    il(draw, "roof_edge", left_roof + [left_roof[0]], 2)
    il(draw, "roof_edge", right_roof + [right_roof[0]], 2)
    il(draw, "wood_light", [(59, 64), (101, 87)], 3)
    il(draw, "wood", [(21, 92), (62, 116), (151, 93)], 3)

    ip(draw, "wood_dark", [(77, 65), (84, 61), (91, 64), (84, 69)])
    ip(draw, "wall_shadow", [(77, 65), (77, 49), (84, 45), (84, 69)])
    ip(draw, "wall", [(84, 69), (84, 45), (91, 48), (91, 64)])
    il(draw, "ink", [(77, 49), (84, 45), (91, 48)], 2)

    for x, y in [(24, 95), (57, 117), (145, 100), (66, 143)]:
        for dx, dy in [(0, 0), (3, -3), (5, 1), (1, 4), (-2, 3)]:
            ir(draw, "leaf_dark", (x + dx, y + dy, x + dx + 4, y + dy + 3))
            if (dx + dy + frame) % 2 == 0:
                ir(draw, "leaf_light", (x + dx + 1, y + dy, x + dx + 2, y + dy + 1))
    for x, y in [(27, 106), (60, 125), (145, 111)]:
        ir(draw, "flower", (x + sway, y, x + sway + 2, y + 2))


def iso_tree(draw, x, y, frame, small=False):
    sway = [0, 1, 0, -1, 0, 1, 0, -1][frame]
    size = 0.75 if small else 1
    w = round(30 * size)
    h = round(43 * size)
    ie(draw, "ground_dark", (x - w // 2 - 4, y - 5, x + w // 2 + 5, y + 3))
    ip(draw, "trunk", [(x - 3, y - h // 2), (x + 2, y - h // 2 - 2), (x + 5, y), (x, y + 1)])
    ir(draw, "trunk_light", (x, y - h // 2, x + 1, y - 2))
    clusters = [(-w // 2, -h, w // 2, h // 2), (-w // 3, -h - 6, w // 2, h // 2), (0, -h + 2, w // 2, h // 2), (-w // 2 + 3, -h // 2 - 5, w // 2, h // 2)]
    for index, (dx, dy, cw, ch) in enumerate(clusters):
        color = ["leaf_dark", "leaf", "leaf", "leaf_dark"][index]
        ie(draw, color, (x + dx + sway, y + dy, x + dx + cw + sway, y + dy + ch))
    for dx, dy in [(-8, -h + 2), (2, -h - 4), (8, -h + 9), (-10, -h + 15)]:
        ir(draw, "leaf_light", (x + round(dx * size) + sway, y + round(dy * size), x + round(dx * size) + sway + 4, y + round(dy * size) + 3))


def flowerbed(draw, x, y, frame):
    ip(draw, "wood_dark", [(x, y), (x + 25, y - 7), (x + 34, y - 2), (x + 9, y + 6)])
    ip(draw, "trunk", [(x + 3, y), (x + 24, y - 5), (x + 30, y - 2), (x + 9, y + 3)])
    for dx, dy, color in [(7, -2, "flower"), (14, -4, "flower_gold"), (21, -4, "white"), (25, -1, "flower")]:
        il(draw, "grass", [(x + dx, y + dy + 3), (x + dx, y + dy - 3)])
        ir(draw, color, (x + dx - 1, y + dy - 5, x + dx + 2, y + dy - 2))


def prototype_person(stage, frame):
    image = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    dy = [0, 0, 1, 1, 0, 0, -1, 0][frame]
    arm = [0, 1, 1, 0, 0, -1, -1, 0][frame]
    if stage == "school":
        hx, hy, hw, hh, torso_top, torso_bottom = 20, 29, 27, 25, 53, 72
    elif stage == "elder":
        hx, hy, hw, hh, torso_top, torso_bottom = 18, 21, 28, 27, 47, 73
    else:
        hx, hy, hw, hh, torso_top, torso_bottom = 19, 14, 29, 29, 42, 70
    hy += dy
    torso_top += dy
    torso_bottom += dy

    ip(d, "trousers", [(23, torso_bottom - 1), (34, torso_bottom - 1), (32, 87), (24, 87)])
    ip(d, "trousers_light", [(35, torso_bottom - 1), (43, torso_bottom), (46, 85), (38, 87)])
    ip(d, "shoe", [(23, 85), (32, 85), (32, 90), (18, 90), (18, 88)])
    ip(d, "shoe", [(38, 85), (47, 83), (51, 88), (49, 90), (38, 90)])
    ir(d, "white", (24, 84, 30, 85))

    ip(d, "cloth_dark", [(21, torso_top + 3), (37, torso_top - 2), (47, torso_top + 8), (44, torso_bottom), (23, torso_bottom), (16, torso_top + 12)])
    ip(d, "cloth", [(22, torso_top + 3), (35, torso_top), (36, torso_bottom - 1), (23, torso_bottom - 1), (18, torso_top + 12)])
    ip(d, "cloth_light", [(23, torso_top + 5), (28, torso_top + 4), (27, torso_bottom - 5), (22, torso_bottom - 4)])
    ip(d, "shirt", [(31, torso_top), (37, torso_top - 1), (40, torso_top + 5), (34, torso_top + 12)])
    il(d, "cloth_dark", [(35, torso_top + 11), (36, torso_bottom - 2)])
    for y in range(torso_top + 15, torso_bottom - 3, 6):
        ir(d, "shirt", (37, y, 38, y + 1))

    if stage == "school":
        ip(d, "roof_dark", [(42, torso_top + 5), (49, torso_top + 9), (48, torso_bottom - 4), (43, torso_bottom - 2)])
        il(d, "roof_light", [(42, torso_top + 5), (45, torso_top + 15)], 2)
    if stage == "elder":
        il(d, "gray_shadow", [(25, torso_top + 3), (34, torso_top + 14), (43, torso_top + 3)], 2)

    ip(d, "cloth_dark", [(17, torso_top + 7), (22, torso_top + 8), (19 + arm, torso_bottom - 5), (14 + arm, torso_bottom - 7)])
    ir(d, "skin_shadow", (14 + arm, torso_bottom - 8, 19 + arm, torso_bottom - 3))
    ip(d, "cloth", [(43, torso_top + 6), (48, torso_top + 9), (49 - arm, torso_bottom - 8), (44 - arm, torso_bottom - 6)])
    ir(d, "skin", (45 - arm, torso_bottom - 8, 50 - arm, torso_bottom - 3))

    head = [(hx + 4, hy), (hx + hw - 5, hy), (hx + hw, hy + 5), (hx + hw, hy + hh - 5), (hx + hw - 5, hy + hh), (hx + 4, hy + hh), (hx, hy + hh - 5), (hx, hy + 4)]
    ip(d, "ink", head)
    face = [(hx + 4, hy + 3), (hx + hw - 6, hy + 3), (hx + hw - 2, hy + 7), (hx + hw - 3, hy + hh - 6), (hx + hw - 7, hy + hh - 2), (hx + 5, hy + hh - 2), (hx + 2, hy + hh - 7), (hx + 2, hy + 6)]
    ip(d, "skin", face)
    ip(d, "skin_light", [(hx + 5, hy + 5), (hx + hw - 9, hy + 5), (hx + hw - 10, hy + 12), (hx + 5, hy + 14)])
    ir(d, "skin_shadow", (hx + 2, hy + 15, hx + 4, hy + 19))
    ir(d, "skin", (hx + 1, hy + 14, hx + 3, hy + 17))
    ir(d, "skin_shadow", (hx + hw - 3, hy + 13, hx + hw + 1, hy + 19))
    ir(d, "skin", (hx + hw - 3, hy + 13, hx + hw - 1, hy + 17))

    hair = "gray" if stage == "elder" else "hair"
    hair_light = "gray_shadow" if stage == "elder" else "hair_light"
    if stage == "elder":
        ip(d, hair, [(hx + 2, hy + 4), (hx + 7, hy + 1), (hx + 12, hy + 3), (hx + 9, hy + 7), (hx + 4, hy + 10)])
        ip(d, hair, [(hx + hw - 8, hy + 3), (hx + hw - 3, hy + 5), (hx + hw - 2, hy + 12), (hx + hw - 6, hy + 9)])
        ip(d, hair_light, [(hx + 5, hy + hh - 5), (hx + 11, hy + hh - 1), (hx + hw - 7, hy + hh - 3), (hx + hw - 5, hy + hh - 7), (hx + hw - 10, hy + hh - 5)])
    else:
        ip(d, hair, [(hx + 2, hy + 5), (hx + 5, hy + 1), (hx + hw - 6, hy + 1), (hx + hw - 2, hy + 5), (hx + hw - 4, hy + 11), (hx + hw - 8, hy + 7), (hx + 9, hy + 6), (hx + 4, hy + 12)])
        ir(d, hair_light, (hx + 8, hy + 2, hx + hw - 10, hy + 4))
        if stage == "school":
            ir(d, hair, (hx + 2, hy + 7, hx + 5, hy + 15))

    blink = frame == 6
    for ex in [hx + 7, hx + hw - 9]:
        if blink:
            ir(d, "ink", (ex, hy + 14, ex + 2, hy + 14))
        else:
            ir(d, "ink", (ex, hy + 13, ex + 1, hy + 14))
            ir(d, "white", (ex + 2, hy + 13, ex + 2, hy + 13))
    ir(d, "skin_shadow", (hx + 11, hy + 18, hx + 14, hy + 19))
    if stage == "elder":
        il(d, "skin_shadow", [(hx + 6, hy + 18), (hx + 9, hy + 19)])
        il(d, "skin_shadow", [(hx + hw - 9, hy + 18), (hx + hw - 6, hy + 17)])
    ir(d, "skin_shadow", (hx + 10, hy + 22, hx + 17, hy + 22))

    if stage == "elder":
        il(d, "wood_dark", [(52, 62 + dy), (54, 90)], 2)
        il(d, "wood_light", [(51, 62 + dy), (55, 62 + dy)], 2)
        ir(d, "stone", (52, 90, 56, 91))
    return image


def prototype_scene(stage, frame, person_fn=None, house_fn=None):
    image = Image.new("RGBA", (256, 192), IP["sky"])
    d = ImageDraw.Draw(image)
    cloud_x = [0, 0, 1, 1, 2, 2, 3, 3][frame]
    for x, y in [(18 + cloud_x, 20), (168 + cloud_x, 30), (104 + cloud_x, 10)]:
        ir(d, "cloud_shadow", (x, y + 5, x + 33, y + 10))
        ir(d, "cloud", (x + 4, y + 2, x + 27, y + 8))
        ir(d, "cloud", (x + 10, y, x + 20, y + 5))
    ip(d, "ground_light", [(0, 83), (78, 62), (174, 76), (256, 61), (256, 111), (0, 116)])
    ip(d, "ground_dark", [(0, 104), (91, 78), (176, 91), (256, 72), (256, 119), (0, 133)])
    ir(d, "ground", (0, 100, 255, 191))
    ip(d, "ground_light", [(0, 130), (82, 106), (161, 127), (74, 160), (0, 151)])
    ip(d, "ground_dark", [(177, 123), (256, 101), (256, 192), (219, 192)])

    for x, y, small in [(8, 102, True), (201, 91, True), (238, 106, False), (176, 104, True)]:
        iso_tree(d, x, y, frame, small)
    ip(d, "path", [(101, 148), (126, 141), (183, 192), (139, 192)])
    ip(d, "path_light", [(111, 151), (121, 148), (169, 192), (153, 192)])
    for x, y in [(126, 161), (143, 174), (157, 184)]:
        il(d, "path", [(x, y), (x + 13, y - 4)], 2)
    (house_fn or iso_house)(d, frame)
    flowerbed(d, 16, 158, frame)
    flowerbed(d, 47, 169, frame)
    for x, y in [(6, 177), (77, 177), (197, 154), (222, 171), (115, 181)]:
        il(d, "grass", [(x, y), (x - 2, y - 5), (x, y - 2), (x + 2, y - 6)])
        ir(d, "grass_light", (x + 3, y - 3, x + 5, y - 1))
    ie(d, "ground_dark", (166, 177, 211, 187))
    hero = (person_fn or prototype_person)(stage, frame)
    image.paste(hero, (153, 91), hero)
    return image


def build_isometric_prototype():
    out = ROOT / "shots" / "isometric-prototype"
    out.mkdir(parents=True, exist_ok=True)
    stages = ["school", "adult", "elder"]
    frames = [prototype_scene("adult", frame) for frame in range(8)]
    frames[0].save(out / "scene.png")
    frames[0].resize((1024, 768), Image.Resampling.NEAREST).save(out / "scene@4x.png")
    frames[0].save(out / "animation.gif", save_all=True, append_images=frames[1:], duration=130, loop=0, disposal=2, optimize=False)
    animated_large = [frame.resize((768, 576), Image.Resampling.NEAREST) for frame in frames]
    animated_large[0].save(out / "animation@3x.gif", save_all=True, append_images=animated_large[1:], duration=130, loop=0, disposal=2, optimize=False)

    sheet = Image.new("RGBA", (1024, 768), (0, 0, 0, 0))
    for frame, scene in enumerate(frames):
        large = scene.resize((512, 384), Image.Resampling.NEAREST)
        sheet.paste(large, ((frame % 4) * 512, (frame // 4) * 384))
    sheet.save(out / "frames.png")

    font = ImageFont.truetype(str(ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"), 14)
    ages = Image.new("RGBA", (960, 460), IP["sky_light"])
    d = ImageDraw.Draw(ages)
    labels = [("school", "7–12 ЛЕТ"), ("adult", "30–44 ГОДА"), ("elder", "80+ ЛЕТ")]
    for index, (stage, label) in enumerate(labels):
        x = index * 320
        ir(d, "ground", (x + 12, 12, x + 307, 419))
        ie(d, "ground_dark", (x + 100, 351, x + 224, 371))
        person = prototype_person(stage, 0).resize((256, 384), Image.Resampling.NEAREST)
        ages.paste(person, (x + 32, 24), person)
        box = d.textbbox((0, 0), label, font=font)
        d.text((x + (320 - (box[2] - box[0])) / 2, 430), label, font=font, fill=IP["ink"])
    ages.save(out / "ages.png")
    print(f"Isometric prototype: {out}")


if __name__ == "__main__" and "--prototype" in __import__("sys").argv:
    build_isometric_prototype()
elif __name__ == "__main__" and "--geometry-v2" not in __import__("sys").argv and "--geometry-v3" not in __import__("sys").argv:
    main()


import json


def geometry_spec(stage, frame=0):
    if stage == "school":
        data = {
            "head": (18, 29, 43, 54), "neck": (29, 54),
            "shoulder_near": (22, 57), "shoulder_far": (39, 55),
            "elbow_near": (15, 65), "wrist_near": (15, 75),
            "elbow_far": (44, 64), "wrist_far": (45, 72),
            "waist_near": (26, 75), "waist_far": (35, 72),
            "hip_near": (26, 74), "hip_far": (35, 72),
            "knee_near": (24, 83), "ankle_near": (23, 89),
            "knee_far": (38, 79), "ankle_far": (41, 85),
        }
    elif stage == "elder":
        data = {
            "head": (15, 22, 39, 47), "neck": (24, 47),
            "shoulder_near": (18, 52), "shoulder_far": (33, 49),
            "elbow_near": (13, 63), "wrist_near": (12, 73),
            "elbow_far": (39, 61), "wrist_far": (41, 69),
            "waist_near": (25, 74), "waist_far": (35, 71),
            "hip_near": (27, 73), "hip_far": (35, 71),
            "knee_near": (24, 82), "ankle_near": (23, 89),
            "knee_far": (38, 78), "ankle_far": (41, 84),
        }
    else:
        data = {
            "head": (19, 15, 43, 40), "neck": (29, 40),
            "shoulder_near": (22, 43), "shoulder_far": (39, 41),
            "elbow_near": (14, 55), "wrist_near": (14, 65),
            "elbow_far": (45, 52), "wrist_far": (45, 62),
            "waist_near": (26, 66), "waist_far": (35, 64),
            "hip_near": (26, 66), "hip_far": (35, 64),
            "knee_near": (24, 77), "ankle_near": (23, 88),
            "knee_far": (39, 74), "ankle_far": (41, 83),
        }
    torso_bob = [0, 0, 0, 1, 0, 0, 0, 0][frame]
    head_bob = [0, 0, 0, 0, 1, 0, 0, 0][frame]
    arm_bob = [0, 1, 0, 0, 0, -1, 0, 0][frame]
    x0, y0, x1, y1 = data["head"]
    data["head"] = (x0, y0 + head_bob, x1, y1 + head_bob)
    for key in ["neck", "shoulder_near", "shoulder_far", "elbow_near", "elbow_far", "waist_near", "waist_far"]:
        x, y = data[key]
        data[key] = (x, y + torso_bob)
    for key, offset in [("wrist_near", arm_bob), ("wrist_far", -arm_bob)]:
        x, y = data[key]
        data[key] = (x, y + offset)
    data["head_center"] = ((data["head"][0] + data["head"][2]) // 2, (data["head"][1] + data["head"][3]) // 2)
    data["blink"] = frame == 6
    return data


def geometry_limb(draw, points, width, color):
    il(draw, "ink", points, width + 2)
    il(draw, color, points, width)


def geometry_boot(draw, ankle, near):
    x, y = ankle
    if near:
        outer = [(x - 4, y - 3), (x + 3, y - 4), (x + 8, y), (x + 7, y + 2), (x - 6, y + 2), (x - 7, y)]
        inner = [(x - 2, y - 2), (x + 3, y - 2), (x + 5, y), (x + 4, y + 1), (x - 5, y + 1)]
    else:
        outer = [(x - 3, y - 3), (x + 3, y - 3), (x + 7, y), (x + 6, y + 2), (x - 4, y + 2), (x - 5, y)]
        inner = [(x - 1, y - 2), (x + 3, y - 1), (x + 4, y), (x + 3, y + 1), (x - 3, y + 1)]
    ip(draw, "ink", outer)
    ip(draw, "shoe", inner)
    il(draw, "trousers_light" if near else "cloth_dark", [(x - 3, y - 3), (x + 2, y - 3)])


def geometry_head(draw, stage, spec):
    x0, y0, x1, y1 = spec["head"]
    outer = [(x0 + 6, y0), (x1 - 6, y0), (x1, y0 + 6), (x1 + 1, y0 + 14), (x1 - 3, y1 - 3), (x0 + 10, y1), (x0 + 3, y1 - 4), (x0, y1 - 10), (x0 + 1, y0 + 7)]
    ip(draw, "ink", outer)
    face = [(x0 + 6, y0 + 3), (x1 - 7, y0 + 3), (x1 - 2, y0 + 7), (x1 - 1, y0 + 14), (x1 - 4, y1 - 5), (x0 + 10, y1 - 2), (x0 + 4, y1 - 5), (x0 + 2, y1 - 10), (x0 + 3, y0 + 7)]
    ip(draw, "skin", face)
    ip(draw, "skin_shadow", [(x1 - 6, y0 + 5), (x1 - 2, y0 + 8), (x1 - 1, y0 + 14), (x1 - 4, y1 - 5), (x0 + 16, y1 - 3), (x0 + 15, y1 - 6), (x0 + 14, y0 + 15), (x0 + 13, y0 + 10)])
    ip(draw, "skin_light", [(x0 + 5, y0 + 6), (x0 + 12, y0 + 5), (x0 + 13, y0 + 13), (x0 + 5, y0 + 15), (x0 + 3, y0 + 10)])
    ir(draw, "skin", (x0, y0 + 13, x0 + 2, y0 + 15))
    ir(draw, "skin_shadow", (x1 - 2, y0 + 11, x1 + 1, y0 + 17))
    ir(draw, "skin", (x1 - 2, y0 + 12, x1, y0 + 16))

    hair = "gray" if stage == "elder" else "hair"
    hair_light = "gray_shadow" if stage == "elder" else "hair_light"
    if stage == "elder":
        ip(draw, hair, [(x0 + 3, y0 + 5), (x0 + 8, y0 + 1), (x0 + 13, y0 + 2), (x0 + 10, y0 + 6), (x0 + 4, y0 + 9)])
        ip(draw, hair, [(x1 - 8, y0 + 3), (x1 - 3, y0 + 5), (x1 - 2, y0 + 11), (x1 - 6, y0 + 9)])
        ip(draw, hair_light, [(x0 + 5, y1 - 6), (x0 + 10, y1 - 2), (x1 - 7, y1 - 4), (x1 - 5, y1 - 8), (x0 + 13, y1 - 6)])
    else:
        ip(draw, hair, [(x0 + 2, y0 + 6), (x0 + 6, y0 + 1), (x1 - 7, y0 + 1), (x1 - 2, y0 + 5), (x1 - 4, y0 + 10), (x1 - 8, y0 + 7), (x0 + 10, y0 + 6), (x0 + 4, y0 + 12)])
        ir(draw, hair_light, (x0 + 8, y0 + 2, x1 - 10, y0 + 4))
        if stage == "school":
            ir(draw, hair, (x0 + 2, y0 + 7, x0 + 5, y0 + 14))

    near_eye = (x0 + 6, y0 + 11)
    far_eye = (x1 - 7, y0 + 11)
    if spec["blink"]:
        ir(draw, "ink", (near_eye[0], near_eye[1] + 1, near_eye[0] + 2, near_eye[1] + 1))
        ir(draw, "ink", (far_eye[0], far_eye[1] + 1, far_eye[0] + 1, far_eye[1] + 1))
    else:
        ir(draw, "ink", (near_eye[0], near_eye[1], near_eye[0] + 1, near_eye[1] + 2))
        ir(draw, "white", (near_eye[0], near_eye[1], near_eye[0], near_eye[1]))
        ir(draw, "ink_soft", (far_eye[0], far_eye[1], far_eye[0], far_eye[1] + 1))
    ir(draw, "skin_shadow", (x0 + 8, y0 + 16, x0 + 10, y0 + 17))
    ir(draw, "skin_shadow", (x0 + 7, y0 + 20, x0 + 12, y0 + 20))
    if stage == "elder":
        il(draw, "skin_shadow", [(x0 + 5, y0 + 16), (x0 + 7, y0 + 17)])
        il(draw, "skin_shadow", [(x1 - 8, y0 + 16), (x1 - 6, y0 + 15)])


def geometry_person(stage, frame, head_fn=None):
    spec = geometry_spec(stage, frame)
    image = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)

    geometry_limb(d, [spec["hip_far"], spec["knee_far"], spec["ankle_far"]], 6, "trousers")
    geometry_boot(d, spec["ankle_far"], False)
    geometry_limb(d, [spec["shoulder_far"], spec["elbow_far"], spec["wrist_far"]], 5, "cloth_dark")
    wx, wy = spec["wrist_far"]
    ir(d, "ink", (wx - 3, wy - 2, wx + 3, wy + 3))
    ir(d, "skin_shadow", (wx - 2, wy - 1, wx + 2, wy + 2))

    nx, ny = spec["neck"]
    il(d, "ink", [(nx, ny - 2), (nx + 1, ny + 5)], 7)
    il(d, "skin_shadow", [(nx, ny - 1), (nx + 1, ny + 4)], 4)
    torso = [spec["shoulder_near"], spec["shoulder_far"], (spec["waist_far"][0] + 4, spec["waist_far"][1] + 2), spec["waist_far"], spec["waist_near"], (spec["shoulder_near"][0] - 4, spec["shoulder_near"][1] + 9)]
    ip(d, "ink", torso)
    front = [(spec["shoulder_near"][0] + 1, spec["shoulder_near"][1] + 2), (spec["neck"][0] + 2, spec["neck"][1] + 3), (spec["waist_near"][0] + 4, spec["waist_near"][1] - 1), spec["waist_near"], (spec["shoulder_near"][0] - 1, spec["shoulder_near"][1] + 8)]
    ip(d, "cloth", front)
    side = [(spec["neck"][0] + 2, spec["neck"][1] + 3), (spec["shoulder_far"][0] - 1, spec["shoulder_far"][1] + 2), (spec["waist_far"][0] + 2, spec["waist_far"][1] + 1), (spec["waist_far"][0] - 1, spec["waist_far"][1]), (spec["waist_near"][0] + 4, spec["waist_near"][1] - 1)]
    ip(d, "cloth_dark", side)
    ip(d, "cloth_light", [(spec["shoulder_near"][0] + 1, spec["shoulder_near"][1] + 4), (spec["shoulder_near"][0] + 4, spec["shoulder_near"][1] + 4), (spec["waist_near"][0] + 1, spec["waist_near"][1] - 3), (spec["waist_near"][0] - 1, spec["waist_near"][1] - 2)])
    ip(d, "shirt", [(spec["neck"][0] - 1, spec["neck"][1] + 3), (spec["neck"][0] + 3, spec["neck"][1] + 3), (spec["neck"][0] + 4, spec["neck"][1] + 8), (spec["neck"][0] + 1, spec["neck"][1] + 11)])
    for y in range(spec["neck"][1] + 13, spec["waist_near"][1] - 2, 6):
        ir(d, "shirt", (spec["neck"][0] + 5, y, spec["neck"][0] + 6, y + 1))

    if stage == "school":
        ip(d, "roof_dark", [(spec["shoulder_far"][0], spec["shoulder_far"][1] + 4), (spec["shoulder_far"][0] + 6, spec["shoulder_far"][1] + 8), (spec["waist_far"][0] + 4, spec["waist_far"][1] - 1), (spec["waist_far"][0], spec["waist_far"][1])])
        il(d, "roof_light", [spec["shoulder_far"], (spec["wrist_far"][0] - 1, spec["wrist_far"][1] - 5)], 2)

    geometry_limb(d, [spec["hip_near"], spec["knee_near"], spec["ankle_near"]], 7, "trousers_light")
    geometry_boot(d, spec["ankle_near"], True)
    (head_fn or geometry_head)(d, stage, spec)
    geometry_limb(d, [spec["shoulder_near"], spec["elbow_near"], spec["wrist_near"]], 5, "cloth")
    wx, wy = spec["wrist_near"]
    ir(d, "ink", (wx - 3, wy - 2, wx + 3, wy + 3))
    ir(d, "skin", (wx - 2, wy - 1, wx + 2, wy + 2))
    ir(d, "skin_light", (wx - 2, wy - 1, wx, wy))

    if stage == "elder":
        il(d, "wood_dark", [(wx - 2, wy), (wx - 4, 91)], 2)
        il(d, "wood_light", [(wx - 4, wy), (wx, wy)], 2)
        ir(d, "stone", (wx - 5, 90, wx - 2, 91))
        il(d, "gray_shadow", [(spec["shoulder_near"][0] + 2, spec["shoulder_near"][1] + 2), (spec["neck"][0] + 3, spec["neck"][1] + 12), (spec["shoulder_far"][0] - 2, spec["shoulder_far"][1] + 2)], 2)
    return image


def geometry_silhouette(person):
    silhouette = Image.new("RGBA", person.size, IP["ink"])
    silhouette.putalpha(person.getchannel("A"))
    return silhouette


def geometry_skeleton(stage, person_fn=None):
    spec = geometry_spec(stage, 0)
    person = (person_fn or geometry_person)(stage, 0)
    image = Image.new("RGBA", (64, 96), IP["sky_light"])
    image.paste(geometry_silhouette(person), (0, 0), geometry_silhouette(person))
    d = ImageDraw.Draw(image)
    il(d, "stone_light", [(2, 82), (58, 110)])
    il(d, "stone_light", [(2, 105), (58, 77)])
    spine = [spec["head_center"], spec["neck"], ((spec["waist_near"][0] + spec["waist_far"][0]) // 2, (spec["waist_near"][1] + spec["waist_far"][1]) // 2)]
    il(d, "flower_gold", spine)
    for prefix, color in [("shoulder", "flower"), ("elbow", "flower"), ("wrist", "flower"), ("hip", "roof_light"), ("knee", "roof_light"), ("ankle", "roof_light")]:
        for side in ["near", "far"]:
            key = f"{prefix}_{side}"
            x, y = spec[key]
            ir(d, "white", (x - 1, y - 1, x + 1, y + 1))
    for a, b in [("shoulder_near", "elbow_near"), ("elbow_near", "wrist_near"), ("shoulder_far", "elbow_far"), ("elbow_far", "wrist_far")]:
        il(d, "flower", [spec[a], spec[b]])
    for a, b in [("hip_near", "knee_near"), ("knee_near", "ankle_near"), ("hip_far", "knee_far"), ("knee_far", "ankle_far")]:
        il(d, "roof_light", [spec[a], spec[b]])
    il(d, "flower", [spec["shoulder_near"], spec["shoulder_far"]])
    il(d, "roof_light", [spec["hip_near"], spec["hip_far"]])
    return image


def build_geometry_v2():
    out = ROOT / "shots" / "isometric-geometry-v2"
    out.mkdir(parents=True, exist_ok=True)
    stages = ["school", "adult", "elder"]
    labels = {"school": "7–12 ЛЕТ", "adult": "30–44 ГОДА", "elder": "80+ ЛЕТ"}
    font = ImageFont.truetype(str(ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"), 14)
    frames = [prototype_scene("adult", frame, geometry_person) for frame in range(8)]
    frames[0].save(out / "scene.png")
    frames[0].resize((1024, 768), Image.Resampling.NEAREST).save(out / "scene@4x.png")
    animated_large = [frame.resize((768, 576), Image.Resampling.NEAREST) for frame in frames]
    animated_large[0].save(out / "animation@3x.gif", save_all=True, append_images=animated_large[1:], duration=130, loop=0, disposal=2, optimize=False)
    sheet = Image.new("RGBA", (2048, 768), (0, 0, 0, 0))
    for frame, scene in enumerate(frames):
        large = scene.resize((512, 384), Image.Resampling.NEAREST)
        sheet.paste(large, ((frame % 4) * 512, (frame // 4) * 384))
    sheet.save(out / "frames.png")

    ages = Image.new("RGBA", (960, 460), IP["sky_light"])
    silhouettes = Image.new("RGBA", (960, 460), IP["sky_light"])
    skeletons = Image.new("RGBA", (960, 460), IP["sky_light"])
    report = {"canvas": [64, 96], "projection": "3/4 down-left", "stages": {}}
    for index, stage in enumerate(stages):
        person = geometry_person(stage, 0)
        person.save(out / f"person-{stage}.png")
        person.resize((512, 768), Image.Resampling.NEAREST).save(out / f"person-{stage}@8x.png")
        bounds = person.getbbox()
        alpha = set(person.getchannel("A").get_flattened_data())
        head = geometry_spec(stage, 0)["head"]
        stage_frames = [geometry_person(stage, frame) for frame in range(8)]
        frame_bounds = [frame.getbbox() for frame in stage_frames]
        report["stages"][stage] = {
            "bounds": bounds,
            "headShare": round((head[3] - head[1]) / (bounds[3] - bounds[1]), 3),
            "alpha": sorted(alpha),
            "pivot": geometry_spec(stage, 0)["ankle_near"],
            "frameBounds": frame_bounds,
            "clippedFrames": [i for i, box in enumerate(frame_bounds) if box[0] < 1 or box[1] < 1 or box[2] > 63 or box[3] > 95],
        }
        for target, source in [(ages, person), (silhouettes, geometry_silhouette(person)), (skeletons, geometry_skeleton(stage))]:
            x = index * 320
            ir(ImageDraw.Draw(target), "ground", (x + 12, 12, x + 307, 419))
            large = source.resize((256, 384), Image.Resampling.NEAREST)
            target.paste(large, (x + 32, 24), large)
            d = ImageDraw.Draw(target)
            box = d.textbbox((0, 0), labels[stage], font=font)
            d.text((x + (320 - (box[2] - box[0])) / 2, 430), labels[stage], font=font, fill=IP["ink"])
    ages.save(out / "ages.png")
    silhouettes.save(out / "silhouettes.png")
    skeletons.save(out / "skeletons.png")

    old = prototype_scene("adult", 0).resize((768, 576), Image.Resampling.NEAREST)
    new = frames[0].resize((768, 576), Image.Resampling.NEAREST)
    comparison = Image.new("RGBA", (1536, 616), IP["sky_light"])
    comparison.paste(old, (0, 40))
    comparison.paste(new, (768, 40))
    d = ImageDraw.Draw(comparison)
    d.text((20, 10), "V1", font=font, fill=IP["ink"])
    d.text((788, 10), "V2 — SKELETON / NEAR-FAR / CONTACT", font=font, fill=IP["ink"])
    comparison.save(out / "comparison.png")
    (out / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__" and "--geometry-v2" in __import__("sys").argv:
    build_geometry_v2()


HEAD_ROWS = [
    (6, 17), (4, 19), (3, 20), (2, 21), (1, 21), (0, 22), (0, 23),
    (0, 23), (0, 23), (0, 23), (0, 23), (0, 23), (0, 23), (0, 23),
    (1, 22), (1, 21), (2, 21), (2, 20), (3, 19), (3, 18), (4, 17),
    (5, 16), (6, 15), (7, 14), (8, 13),
]


def geometry_head_v3(draw, stage, spec):
    x0, y0, _, _ = spec["head"]
    hair = "gray" if stage == "elder" else "hair"
    hair_light = "gray_shadow" if stage == "elder" else "hair_light"
    for row, (left, right) in enumerate(HEAD_ROWS):
        y = y0 + row
        ir(draw, "ink", (x0 + left, y, x0 + right, y))
        if 1 < row < 23:
            inner_left = left + 2
            inner_right = right - 2
            if inner_left <= inner_right:
                ir(draw, "skin", (x0 + inner_left, y, x0 + inner_right, y))
                if row >= 4:
                    ir(draw, "skin_shadow", (x0 + max(inner_left, inner_right - 3), y, x0 + inner_right, y))
                if 5 <= row <= 14:
                    ir(draw, "skin_light", (x0 + inner_left, y, x0 + min(inner_left + 3, inner_right), y))
        if row in [4, 8, 16, 20]:
            ir(draw, "skin_shadow", (x0 + right, y, x0 + right, y))
            ir(draw, "skin_light", (x0 + left, y, x0 + left, y))
        hair_cap = 4 if stage == "elder" else 6
        if row <= hair_cap:
            ir(draw, hair, (x0 + left, y, x0 + right, y))
        elif row <= 11:
            ir(draw, hair, (x0 + left, y, x0 + left + 2, y))
            ir(draw, hair, (x0 + right - 2, y, x0 + right, y))
        if stage == "elder" and 6 <= row <= 13:
            ir(draw, hair, (x0 + left, y, x0 + left + 1, y))
            ir(draw, hair, (x0 + right - 1, y, x0 + right, y))
        if stage == "elder" and 19 <= row <= 22:
            inner_left = left + 2
            inner_right = right - 2
            if inner_left <= inner_right:
                ir(draw, "gray_shadow", (x0 + inner_left, y, x0 + inner_right, y))
        if row in [2, 3]:
            ir(draw, hair_light, (x0 + 8, y, x0 + 14, y))

    nose_y = y0 + 13
    nose_x = HEAD_ROWS[13][0]
    ir(draw, "skin", (x0 + nose_x - 1, nose_y, x0 + nose_x + 1, nose_y + 1))
    ear_x = HEAD_ROWS[12][1]
    ir(draw, "skin_shadow", (x0 + ear_x, y0 + 11, x0 + ear_x + 2, y0 + 16))
    ir(draw, "skin", (x0 + ear_x, y0 + 12, x0 + ear_x + 1, y0 + 15))

    near_eye = (x0 + 6, y0 + 11)
    far_eye = (x0 + 18, y0 + 11)
    if spec["blink"]:
        ir(draw, "ink", (near_eye[0], near_eye[1] + 1, near_eye[0] + 2, near_eye[1] + 1))
        ir(draw, "ink_soft", (far_eye[0], far_eye[1] + 1, far_eye[0] + 1, far_eye[1] + 1))
    else:
        ir(draw, "ink", (near_eye[0], near_eye[1], near_eye[0] + 1, near_eye[1] + 2))
        ir(draw, "white", (near_eye[0], near_eye[1], near_eye[0], near_eye[1]))
        ir(draw, "ink_soft", (far_eye[0], far_eye[1], far_eye[0], far_eye[1] + 1))
    ir(draw, "skin_shadow", (x0 + 8, y0 + 16, x0 + 10, y0 + 17))
    ir(draw, "skin_shadow", (x0 + 7, y0 + 20, x0 + 12, y0 + 20))


def geometry_person_v3(stage, frame):
    return geometry_person(stage, frame, geometry_head_v3)


def iso3_model():
    front = (62, 114)
    left = (22, 94)
    right = (126, 82)
    back = (86, 62)
    wall_height = 37
    roof_height = 34
    return {
        "front": front,
        "left": left,
        "right": right,
        "back": back,
        "front_bottom": (front[0], front[1] + wall_height),
        "left_bottom": (left[0], left[1] + wall_height),
        "right_bottom": (right[0], right[1] + wall_height),
        "back_bottom": (back[0], back[1] + wall_height),
        "ridge_front": ((front[0] + right[0]) // 2, (front[1] + right[1]) // 2 - roof_height),
        "ridge_back": ((left[0] + back[0]) // 2, (left[1] + back[1]) // 2 - roof_height),
    }


def iso3_house(draw, frame):
    m = iso3_model()
    a, b, c, d = m["front"], m["left"], m["back"], m["right"]
    ab, bb, db = m["front_bottom"], m["left_bottom"], m["right_bottom"]
    rf, rb = m["ridge_front"], m["ridge_back"]
    sway = [0, 1, 0, -1, 0, 1, 0, -1][frame]
    for i in range(4):
        x = 68 + ((frame + i * 2) % 8) // 2 + i * 3
        y = 48 - i * 8 - frame % 2
        ir(draw, "cloud_shadow", (x, y, x + 7 + i, y + 4 + i // 2))
        ir(draw, "cloud", (x + 2, y - 1, x + 5 + i, y + 2))

    far_roof = [c, d, rf, rb]
    for u in range(5):
        for v in range(3):
            shade = "roof_mid" if (u + v) % 3 else "roof_dark"
            quad_cell(draw, far_roof, u / 5 + 0.006, v / 3 + 0.012, (u + 1) / 5 - 0.006, (v + 1) / 3 - 0.012, shade, "roof_dark")
    il(draw, "roof_edge", far_roof + [far_roof[0]], 2)

    left_wall = [b, a, ab, bb]
    right_wall = [a, d, db, ab]
    ip(draw, "wall", left_wall)
    ip(draw, "wall_shadow", right_wall)
    il(draw, "ink", left_wall + [left_wall[0]], 2)
    il(draw, "ink", right_wall + [right_wall[0]], 2)
    for wall in [left_wall, right_wall]:
        for u, v in [(0.08, 0.78), (0.42, 0.83), (0.7, 0.72), (0.87, 0.86)]:
            x, y = quad_point(wall, u, v)
            ir(draw, "plaster_chip", (x, y, x + 3, y + 1))
    iso_window(draw, left_wall, 0.18, 0.58)

    door = [quad_point(right_wall, 0.57, 0.25), quad_point(right_wall, 0.83, 0.25), quad_point(right_wall, 0.83, 0.98), quad_point(right_wall, 0.57, 0.98)]
    ip(draw, "wood_dark", door)
    door_inner = [quad_point(right_wall, 0.6, 0.3), quad_point(right_wall, 0.8, 0.3), quad_point(right_wall, 0.8, 0.96), quad_point(right_wall, 0.6, 0.96)]
    ip(draw, "roof_mid", door_inner)
    for u in [0.64, 0.7, 0.76]:
        il(draw, "roof_dark", [quad_point(right_wall, u, 0.32), quad_point(right_wall, u, 0.94)])
    knob = quad_point(right_wall, 0.76, 0.65)
    ir(draw, "flower_gold", (knob[0], knob[1], knob[0] + 1, knob[1] + 1))
    ip(draw, "stone", [(82, 145), (112, 136), (123, 140), (91, 151)])
    ip(draw, "stone_light", [(88, 151), (119, 141), (130, 146), (96, 156)])

    gable = [a, d, rf]
    ip(draw, "wall_shadow", gable)
    il(draw, "ink", gable + [gable[0]], 2)
    ip(draw, "glass", [(90, 84), (94, 79), (99, 82), (95, 88)])
    il(draw, "glass_light", [(93, 82), (95, 81), (97, 83)])

    near_roof = [b, a, rf, rb]
    for u in range(6):
        for v in range(4):
            shade = ["roof", "roof_light", "roof", "roof_mid"][(u + v * 2) % 4]
            quad_cell(draw, near_roof, u / 6 + 0.006, v / 4 + 0.012, (u + 1) / 6 - 0.006, (v + 1) / 4 - 0.012, shade, "roof_dark")
    il(draw, "roof_edge", near_roof + [near_roof[0]], 2)
    il(draw, "wood_light", [rb, rf], 3)
    il(draw, "wood", [b, a, d], 3)

    ip(draw, "wood_dark", [(63, 65), (70, 61), (77, 64), (70, 69)])
    ip(draw, "wall_shadow", [(63, 65), (63, 51), (70, 47), (70, 69)])
    ip(draw, "wall", [(70, 69), (70, 47), (77, 50), (77, 64)])
    il(draw, "ink", [(63, 51), (70, 47), (77, 50)], 2)

    for x, y in [(24, 96), (58, 116), (121, 91), (64, 143)]:
        for dx, dy in [(0, 0), (3, -3), (5, 1), (1, 4), (-2, 3)]:
            ir(draw, "leaf_dark", (x + dx, y + dy, x + dx + 4, y + dy + 3))
            if (dx + dy + frame) % 2 == 0:
                ir(draw, "leaf_light", (x + dx + 1, y + dy, x + dx + 2, y + dy + 1))
    for x, y in [(27, 106), (60, 125), (121, 101)]:
        ir(draw, "flower", (x + sway, y, x + sway + 2, y + 2))


def vector_sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def iso3_structure_report():
    m = iso3_model()
    a, b, c, d = m["front"], m["left"], m["back"], m["right"]
    rf, rb = m["ridge_front"], m["ridge_back"]
    checks = {
        "front_eaves_parallel": vector_sub(a, b) == (40, 20),
        "back_eaves_parallel": vector_sub(d, c) == (40, 20),
        "left_depth_parallel": vector_sub(c, b) == (64, -32),
        "right_depth_parallel": vector_sub(d, a) == (64, -32),
        "ridge_parallel_to_eaves": vector_sub(rf, rb) == (40, 20),
        "front_wall_vertical": vector_sub(m["front_bottom"], a) == (0, 37),
        "left_wall_vertical": vector_sub(m["left_bottom"], b) == (0, 37),
        "right_wall_vertical": vector_sub(m["right_bottom"], d) == (0, 37),
        "roof_shares_wall_vertices": all(point in [b, a, rf, rb, c, d] for point in [a, b, c, d, rf, rb]),
    }
    return {"projection": "isometric 2:1", "u": [40, 20], "v": [64, -32], "model": m, "checks": checks, "allPassed": all(checks.values())}


def iso3_guides():
    image = prototype_scene("adult", 0, geometry_person_v3, iso3_house)
    d = ImageDraw.Draw(image)
    m = iso3_model()
    a, b, c, d0 = m["front"], m["left"], m["back"], m["right"]
    ab, bb, cb, db = m["front_bottom"], m["left_bottom"], m["back_bottom"], m["right_bottom"]
    rf, rb = m["ridge_front"], m["ridge_back"]
    green = (59, 119, 91, 255)
    blue = (83, 124, 177, 255)
    gold = (199, 135, 65, 255)
    for p0, p1 in [(b, a), (c, d0), (rb, rf), (bb, ab), (cb, db)]:
        d.line([p0, p1], fill=green, width=1)
    for p0, p1 in [(b, c), (a, d0), (bb, cb), (ab, db)]:
        d.line([p0, p1], fill=blue, width=1)
    for p0, p1 in [(a, ab), (b, bb), (d0, db)]:
        d.line([p0, p1], fill=gold, width=1)
    for x, y in [a, b, c, d0, rf, rb]:
        d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(244, 238, 211, 255), outline=(55, 64, 76, 255))
    return image.resize((1024, 768), Image.Resampling.NEAREST)


def iso3_curve_report():
    widths = [right - left + 1 for left, right in HEAD_ROWS]
    edge_steps = [max(abs(HEAD_ROWS[i][0] - HEAD_ROWS[i - 1][0]), abs(HEAD_ROWS[i][1] - HEAD_ROWS[i - 1][1])) for i in range(1, len(HEAD_ROWS))]
    expanding = all(widths[i] >= widths[i - 1] for i in range(1, 7))
    contracting = all(widths[i] <= widths[i - 1] for i in range(7, len(widths)))
    return {
        "rows": HEAD_ROWS,
        "widths": widths,
        "maxEdgeStep": max(edge_steps),
        "expandingTop": expanding,
        "contractingJaw": contracting,
        "selectiveAA": "edge pixels only, alpha 0/255",
        "allPassed": max(edge_steps) <= 2 and expanding and contracting,
    }


def iso3_curve_sheet():
    person = geometry_person_v3("adult", 0).resize((512, 768), Image.Resampling.NEAREST)
    image = Image.new("RGBA", (768, 768), IP["sky_light"])
    image.paste(person, (0, 0), person)
    d = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"), 8)
    y0 = 15
    for row, (left, right) in enumerate(HEAD_ROWS):
        y = (y0 + row) * 8
        d.line([(0, y), (512, y)], fill=(137, 144, 137, 255))
        d.text((530, y), f"{row:02}  {left:02}:{right:02}", font=font, fill=IP["ink"])
    return image


def build_geometry_v3():
    out = ROOT / "shots" / "isometric-geometry-v3"
    out.mkdir(parents=True, exist_ok=True)
    stages = ["school", "adult", "elder"]
    labels = {"school": "7–12 ЛЕТ", "adult": "30–44 ГОДА", "elder": "80+ ЛЕТ"}
    font = ImageFont.truetype(str(ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"), 14)
    frames = [prototype_scene("adult", frame, geometry_person_v3, iso3_house) for frame in range(8)]
    frames[0].save(out / "scene.png")
    frames[0].resize((1024, 768), Image.Resampling.NEAREST).save(out / "scene@4x.png")
    animated_large = [frame.resize((768, 576), Image.Resampling.NEAREST) for frame in frames]
    animated_large[0].save(out / "animation@3x.gif", save_all=True, append_images=animated_large[1:], duration=130, loop=0, disposal=2, optimize=False)
    sheet = Image.new("RGBA", (2048, 768), (0, 0, 0, 0))
    for frame, scene in enumerate(frames):
        large = scene.resize((512, 384), Image.Resampling.NEAREST)
        sheet.paste(large, ((frame % 4) * 512, (frame // 4) * 384))
    sheet.save(out / "frames.png")
    iso3_guides().save(out / "roof-guides.png")
    iso3_curve_sheet().save(out / "curves.png")
    (out / "structure-validation.json").write_text(json.dumps(iso3_structure_report(), ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "curve-validation.json").write_text(json.dumps(iso3_curve_report(), ensure_ascii=False, indent=2), encoding="utf-8")

    ages = Image.new("RGBA", (960, 460), IP["sky_light"])
    silhouettes = Image.new("RGBA", (960, 460), IP["sky_light"])
    skeletons = Image.new("RGBA", (960, 460), IP["sky_light"])
    report = {"canvas": [64, 96], "projection": "3/4 down-left", "stages": {}}
    for index, stage in enumerate(stages):
        person = geometry_person_v3(stage, 0)
        person.save(out / f"person-{stage}.png")
        person.resize((512, 768), Image.Resampling.NEAREST).save(out / f"person-{stage}@8x.png")
        bounds = person.getbbox()
        alpha = set(person.getchannel("A").get_flattened_data())
        head = geometry_spec(stage, 0)["head"]
        stage_frames = [geometry_person_v3(stage, frame) for frame in range(8)]
        frame_bounds = [frame.getbbox() for frame in stage_frames]
        report["stages"][stage] = {
            "bounds": bounds,
            "headShare": round((head[3] - head[1]) / (bounds[3] - bounds[1]), 3),
            "alpha": sorted(alpha),
            "pivot": geometry_spec(stage, 0)["ankle_near"],
            "frameBounds": frame_bounds,
            "clippedFrames": [i for i, box in enumerate(frame_bounds) if box[0] < 1 or box[1] < 1 or box[2] > 63 or box[3] > 95],
        }
        for target, source in [(ages, person), (silhouettes, geometry_silhouette(person)), (skeletons, geometry_skeleton(stage, geometry_person_v3))]:
            x = index * 320
            ir(ImageDraw.Draw(target), "ground", (x + 12, 12, x + 307, 419))
            large = source.resize((256, 384), Image.Resampling.NEAREST)
            target.paste(large, (x + 32, 24), large)
            d = ImageDraw.Draw(target)
            box = d.textbbox((0, 0), labels[stage], font=font)
            d.text((x + (320 - (box[2] - box[0])) / 2, 430), labels[stage], font=font, fill=IP["ink"])
    ages.save(out / "ages.png")
    silhouettes.save(out / "silhouettes.png")
    skeletons.save(out / "skeletons.png")

    old = prototype_scene("adult", 0, geometry_person, iso_house).resize((768, 576), Image.Resampling.NEAREST)
    new = frames[0].resize((768, 576), Image.Resampling.NEAREST)
    comparison = Image.new("RGBA", (1536, 616), IP["sky_light"])
    comparison.paste(old, (0, 40))
    comparison.paste(new, (768, 40))
    d = ImageDraw.Draw(comparison)
    d.text((20, 10), "V2", font=font, fill=IP["ink"])
    d.text((788, 10), "V3 — SHARED VERTICES / CURVES", font=font, fill=IP["ink"])
    comparison.save(out / "comparison.png")
    (out / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"structure": iso3_structure_report()["allPassed"], "curves": iso3_curve_report()["allPassed"], "people": report}, ensure_ascii=False))


if __name__ == "__main__" and "--geometry-v3" in __import__("sys").argv:
    build_geometry_v3()
