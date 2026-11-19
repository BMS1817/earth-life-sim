import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "kimi"
OUT = ROOT / "public" / "art" / "kimi"
REVIEW = ROOT / "shots" / "kimi-production"
CLIMATES = ("north", "temperate", "tropics")
LEVELS = ("poor", "mid", "rich")
HOUSE_SIZES = {"poor": (80, 64), "mid": (96, 80), "rich": (112, 96)}
HOUSE_CROPS = {
    "north": (
        ((0, 300, 560, 1024), (540, 240, 1160, 1024), (1140, 40, 2048, 1024)),
        ((0, 1140, 580, 1900), (560, 1060, 1160, 1900), (1140, 980, 2048, 1900)),
    ),
    "temperate": (
        ((0, 300, 640, 1024), (620, 240, 1260, 1024), (1240, 60, 2048, 1024)),
        ((0, 1170, 640, 1950), (620, 1100, 1260, 1950), (1240, 1000, 2048, 1950)),
    ),
    "tropics": (
        ((0, 440, 560, 1024), (540, 300, 1200, 1024), (1200, 120, 2048, 1024)),
        ((0, 1000, 580, 1900), (540, 1000, 1210, 1900), (1200, 980, 2048, 1900)),
    ),
}


def opaque(image):
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    rgb = image.convert("RGB").quantize(colors=32, method=Image.Quantize.MEDIANCUT).convert("RGB")
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def cell(image, columns, rows, column, row):
    left = round(image.width * column / columns)
    right = round(image.width * (column + 1) / columns)
    top = round(image.height * row / rows)
    bottom = round(image.height * (row + 1) / rows)
    return image.crop((left, top, right, bottom))


def trim(image):
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    box = alpha.getbbox()
    return image.crop(box) if box else image


def remove_small_components(image):
    pixels = image.load()
    seen = set()
    components = []
    for y in range(image.height):
        for x in range(image.width):
            if (x, y) in seen or pixels[x, y][3] == 0:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            component = []
            while stack:
                px, py = stack.pop()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < image.width and 0 <= ny < image.height and (nx, ny) not in seen and pixels[nx, ny][3] != 0:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            components.append(component)
    if not components:
        return image
    largest = max(len(component) for component in components)
    result = image.copy()
    output = result.load()
    for component in components:
        if len(component) < max(4, largest * 0.12):
            for x, y in component:
                output[x, y] = (0, 0, 0, 0)
    return result


def isolate_main(image, margin=8):
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    pixels = alpha.load()
    seen = set()
    components = []
    for y in range(image.height):
        for x in range(image.width):
            if (x, y) in seen or pixels[x, y] == 0:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            component = []
            while stack:
                px, py = stack.pop()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < image.width and 0 <= ny < image.height and (nx, ny) not in seen and pixels[nx, ny] != 0:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            components.append(component)
    if not components:
        return image
    main = max(components, key=len)
    main_x = [point[0] for point in main]
    main_y = [point[1] for point in main]
    main_box = (min(main_x), min(main_y), max(main_x) + 1, max(main_y) + 1)
    selected = set(main)
    for component in components:
        if component is main:
            continue
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        separated = box[2] < main_box[0] - margin or box[0] > main_box[2] + margin or box[3] < main_box[1] - margin or box[1] > main_box[3] + margin
        if not separated:
            selected.update(component)
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    source = image.load()
    output = result.load()
    for x, y in selected:
        output[x, y] = source[x, y]
    return result


def fit(image, width, height, padding=1):
    source = trim(image)
    scale = min((width - padding * 2) / source.width, (height - padding * 2) / source.height)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    resized = source.resize(size, Image.Resampling.NEAREST)
    result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    result.paste(resized, ((width - size[0]) // 2, height - size[1] - padding))
    return remove_small_components(opaque(remove_small_components(result)))


def save(image, name):
    path = OUT / f"{name}.png"
    image.save(path, optimize=True)
    return image


def build_houses():
    result = []
    for climate in CLIMATES:
        source = Image.open(SOURCE / "environment" / f"houses_{climate}.png").convert("RGBA")
        for row, damaged in enumerate((False, True)):
            for column, level in enumerate(LEVELS):
                name = f"house_{climate}_{level}{'_damaged' if damaged else ''}"
                module = source.crop(HOUSE_CROPS[climate][row][column])
                image = fit(module, *HOUSE_SIZES[level])
                result.append((name, save(image, name)))
    return result


def build_environment():
    result = []
    bands = {
        "sky": (180, 600, 96),
        "far": (740, 1260, 96),
        "near": (1300, 1940, 64),
    }
    for climate in CLIMATES:
        source = Image.open(SOURCE / "environment" / f"environment_{climate}.png").convert("RGBA")
        for layer, (top, bottom, height) in bands.items():
            crop = source.crop((0, top, source.width, bottom))
            image = crop.resize((256, height), Image.Resampling.NEAREST)
            name = f"bg_{climate}_{layer}"
            result.append((name, save(opaque(image), name)))
    return result


def dominant_skin(image, box=None):
    source = image.crop(box) if box else image
    counts = {}
    for r, g, b, a in source.getdata():
        if a == 0 or r <= g or g <= b or r < 95 or g < 55 or r / max(g, 1) > 2.2:
            continue
        key = (r, g, b)
        counts[key] = counts.get(key, 0) + 1
    if not counts:
        return None
    return list(max(counts, key=counts.get))


def analyze_head(image):
    alpha = image.getchannel("A")
    box = alpha.getbbox()
    if not box:
        return {"eye": None, "skin": None}
    left, top, right, bottom = box
    points = []
    for y in range(top, min(bottom, top + round((bottom - top) * 0.65))):
        for x in range(left, right):
            r, g, b, a = image.getpixel((x, y))
            if a and b > 80 and b > r * 1.15 and b > g * 1.05 and r < 170:
                points.append((x, y))
    if not points:
        eye = [left + round((right - left) * 0.68), top + round((bottom - top) * 0.42)]
        return {"eye": eye, "skin": dominant_skin(image)}
    eye = [round(sum(x for x, _ in points) / len(points)), round(sum(y for _, y in points) / len(points))]
    skin = dominant_skin(image, (max(left, eye[0] - 12), min(bottom, eye[1] + 3), min(right, eye[0] + 8), min(bottom, eye[1] + 14)))
    return {"eye": eye, "skin": skin or dominant_skin(image)}


def analyze_body(image):
    box = image.getchannel("A").getbbox()
    if not box:
        return {"skin": None}
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    skin = dominant_skin(image, (left + round(width * 0.3), top, left + round(width * 0.7), top + max(1, round(height * 0.2))))
    return {"skin": skin or dominant_skin(image)}


AGE_KEYS = ("00_infant", "01_early", "02_child", "03_teen", "04_young", "05_adult", "06_mature", "07_senior", "08_elder")
BODY_HEIGHTS = (24, 36, 44, 58, 62, 64, 64, 60, 58)
HEAD_HEIGHTS = (28, 30, 32, 32, 34, 34, 34, 34, 34)


ANALYSIS = {}


def build_people():
    assembled = []
    for age_index, age_key in enumerate(AGE_KEYS):
        heads_source = Image.open(SOURCE / "people" / f"heads_{age_key}.png").convert("RGBA")
        bodies_source = Image.open(SOURCE / "people" / f"bodies_{age_key}.png").convert("RGBA")
        heads = Image.new("RGBA", (384, 128), (0, 0, 0, 0))
        bodies = Image.new("RGBA", (384, 288), (0, 0, 0, 0))
        for column in range(6):
            for row in range(2):
                module = isolate_main(cell(heads_source, 6, 2, column, row), margin=4)
                head = fit(module, 64, HEAD_HEIGHTS[age_index])
                heads.paste(head, (column * 64, row * 64 + 64 - head.height), head)
            for row in range(3):
                module = isolate_main(cell(bodies_source, 6, 3, column, row))
                body = fit(module, 64, BODY_HEIGHTS[age_index])
                bodies.paste(body, (column * 64, row * 96 + 96 - body.height), body)
        save(opaque(heads), f"heads_{age_key}")
        save(opaque(bodies), f"bodies_{age_key}")
        ANALYSIS[age_key] = {
            "heads": [analyze_head(cell(heads, 6, 2, column, row)) for row in range(2) for column in range(6)],
            "bodies": [analyze_body(cell(bodies, 6, 3, column, row)) for row in range(3) for column in range(6)],
        }
        person = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
        body = trim(cell(bodies, 6, 3, 1, 1))
        head = trim(cell(heads, 6, 2, 0, 0))
        body_y = 96 - body.height
        head_y = body_y - head.height + 8
        person.paste(head, ((64 - head.width) // 2, head_y), head)
        person.paste(body, ((64 - body.width) // 2, body_y), body)
        assembled.append((age_key, person))
    contact(assembled, "people-ages.png", columns=9, scale=3)
    return assembled


CAREERS = ("medicine", "education", "engineering", "industry", "agriculture", "services", "pilot")


def build_professions():
    source = Image.open(SOURCE / "people" / "profession_modules.png").convert("RGBA")
    review = []
    career_heights = (47, 48, 48, 46, 44)
    for row, career in enumerate(CAREERS):
        for age_offset, age_index in enumerate(range(4, 9)):
            garments = Image.new("RGBA", (384, 48), (0, 0, 0, 0))
            for column in range(6):
                garment = fit(isolate_main(cell(source, 6, 8, column, row)), 64, career_heights[age_offset])
                garments.paste(garment, (column * 64, 0), garment)
            save(opaque(garments), f"career_{career}_{AGE_KEYS[age_index]}")
            if age_index == 5:
                save(opaque(garments), f"career_{career}")
                review.append((career, cell(garments, 6, 1, 1, 0)))
        prop = fit(cell(source, 6, 8, row if row < 6 else 5, 7), 64, 48)
        save(prop, f"career_{career}_prop")
    contact(review, "professions.png", columns=7, scale=3)


def build_special():
    source = Image.open(SOURCE / "environment" / "special_objects.png").convert("RGBA")
    specs = {
        "war_debris": ((0, 0, 850, 1000), 96, 80),
        "person_evacuee": ((1050, 80, 1500, 1000), 64, 96),
        "war_soldier": ((1450, 80, 2048, 1000), 64, 96),
        "war_smoke": ((0, 950, 600, 1940), 96, 80),
        "war_vehicle": ((550, 1000, 2048, 1940), 96, 64),
    }
    review = []
    for name, (box, width, height) in specs.items():
        image = fit(source.crop(box), width, height)
        review.append((name, save(image, name)))
    contact(review, "special.png", columns=5, scale=2)


def build_secondary():
    source_root = SOURCE / "secondary"
    rooms = Image.open(source_root / "rooms.png").convert("RGBA")
    for index, climate in enumerate(CLIMATES):
        image = cell(rooms, 1, 3, 0, index).resize((256, 192), Image.Resampling.NEAREST)
        background = Image.new("RGBA", image.size, image.getpixel((0, 0)))
        image = Image.alpha_composite(background, image)
        save(opaque(image), f"room_{climate}")
    dreams = Image.open(source_root / "dream_contexts.png").convert("RGBA")
    dream_names = ("reading", "sports", "music", "crafts", "nature", "games", "career", "dream", "fallback")
    for index, name in enumerate(dream_names):
        image = cell(dreams, 3, 3, index % 3, index // 3).resize((256, 192), Image.Resampling.NEAREST)
        background = Image.new("RGBA", image.size, image.getpixel((0, 0)))
        image = Image.alpha_composite(background, image)
        save(opaque(image), f"dream_{name}")
    portraits = Image.open(source_root / "portrait_backgrounds.png").convert("RGBA")
    for index, name in enumerate(("north", "temperate", "tropics", "interior")):
        image = cell(portraits, 2, 2, index % 2, index // 2).resize((64, 64), Image.Resampling.NEAREST)
        background = Image.new("RGBA", image.size, image.getpixel((0, 0)))
        image = Image.alpha_composite(background, image)
        save(opaque(image), f"portrait_{name}")
    headers = Image.open(source_root / "ui_headers.png").convert("RGBA")
    header_names = ("people", "finance", "lifestyle", "politics", "memories", "lineage", "journal", "life")
    for index, name in enumerate(header_names):
        image = cell(headers, 1, 8, 0, index).resize((256, 64), Image.Resampling.NEAREST)
        save(opaque(image), f"header_{name}")
    for name in ("people", "finance", "lifestyle", "memories", "lineage", "journal", "life"):
        filename = "lineage_header_v2_final.png" if name == "lineage" else f"{name}_header_v2.png"
        path = source_root / filename
        if path.exists():
            image = Image.open(path).convert("RGBA").resize((256, 64), Image.Resampling.NEAREST)
            save(opaque(image), f"header_{name}")
    neutral_politics = source_root / "header_politics_neutral.png"
    if neutral_politics.exists():
        save(fit(Image.open(neutral_politics).convert("RGBA"), 256, 64), "header_politics")
    politics_path = source_root / "politics_city_parliament.png"
    if politics_path.exists():
        politics = Image.open(politics_path).convert("RGBA")
        crop_height = round(politics.width * 3 / 4)
        top = (politics.height - crop_height) // 2
        politics = politics.crop((0, top, politics.width, top + crop_height)).resize((256, 192), Image.Resampling.NEAREST)
        save(opaque(politics), "politics_city")
    textures = Image.open(source_root / "ui_textures.png").convert("RGBA")
    for index, name in enumerate(("parchment", "sage", "blue", "lavender")):
        image = cell(textures, 2, 2, index % 2, index // 2).resize((64, 64), Image.Resampling.NEAREST)
        save(opaque(image), f"texture_{name}")
    objects_path = source_root / "life_objects.png"
    if objects_path.exists():
        objects = Image.open(objects_path).convert("RGBA")
        object_names = ("computer", "bicycle", "car", "home", "rental", "dog", "cat", "small", "hobbyGames", "hobbySports", "hobbyReading", "hobbyMusic", "hobbyCrafts", "hobbyNature", "career", "partner", "child", "business")
        for index, name in enumerate(object_names):
            save(fit(cell(objects, 6, 3, index % 6, index // 6), 32, 32), f"object_{name}")


def contact(items, name, columns=6, scale=2):
    if not items:
        return
    cell_w = max(image.width for _, image in items)
    cell_h = max(image.height for _, image in items)
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_w, rows * cell_h), (32, 37, 48, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (label, image) in enumerate(items):
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        sheet.paste(image, (x, y + cell_h - image.height), image)
        draw.text((x + 3, y + 3), label, fill=(245, 240, 220, 255))
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST).save(REVIEW / name)


def build_animation():
    age_key = "05_adult"
    age_index = AGE_KEYS.index(age_key)
    heads = Image.open(OUT / f"heads_{age_key}.png").convert("RGBA")
    bodies = Image.open(OUT / f"bodies_{age_key}.png").convert("RGBA")
    body = cell(bodies, 6, 3, 1, 1)
    head = cell(heads, 6, 2, 0, 0)
    eye = ANALYSIS[age_key]["heads"][0]["eye"]
    frames = []
    offsets = (0, 0, 0, -1, -1, -1, 0, 0)
    for index, offset in enumerate(offsets):
        frame = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
        body_top = body.getchannel("A").getbbox()[1]
        head_bottom = head.getchannel("A").getbbox()[3]
        head_y = body_top + 8 - head_bottom + offset
        frame.paste(head, (0, head_y), head)
        frame.paste(body, (0, 0), body)
        if index == 4 and eye:
            draw = ImageDraw.Draw(frame)
            skin = ANALYSIS[age_key]["heads"][0]["skin"] or (216, 168, 120)
            draw.rectangle((eye[0] - 2, head_y + eye[1] - 1, eye[0] + 1, head_y + eye[1] + 1), fill=tuple(skin) + (255,))
            draw.rectangle((eye[0] - 2, head_y + eye[1], eye[0] + 1, head_y + eye[1]), fill=(42, 32, 24, 255))
        frames.append(frame)
    contact([(str(index + 1), frame) for index, frame in enumerate(frames)], "animation-frames.png", columns=8, scale=3)
    solid = []
    for frame in frames:
        background = Image.new("RGBA", frame.size, (32, 37, 48, 255))
        background.paste(frame, (0, 0), frame)
        solid.append(background)
    solid[0].save(REVIEW / "animation.gif", save_all=True, append_images=solid[1:], duration=125, loop=0, disposal=2)


def validate_output():
    report = {"files": 0, "totalBytes": 0, "badAlpha": [], "empty": [], "houseEdgeContacts": [], "animationFrames": 8}
    for path in sorted(OUT.glob("*.png")):
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        values = {index for index, count in enumerate(alpha.histogram()) if count}
        if not values:
            report["empty"].append(path.name)
        if any(value not in (0, 255) for value in values):
            report["badAlpha"].append(path.name)
        if path.name.startswith("house_"):
            box = alpha.getbbox()
            if box and (box[0] == 0 or box[1] == 0 or box[2] == image.width or box[3] == image.height):
                report["houseEdgeContacts"].append(path.name)
        report["files"] += 1
        report["totalBytes"] += path.stat().st_size
    (REVIEW / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def merge_socket_manifest(manifest):
    path = OUT / "socket" / "manifest.json"
    if not path.exists():
        return manifest
    socket = json.loads(path.read_text(encoding="utf-8"))
    if not socket.get("complete"):
        return manifest
    by_age = {item["key"]: item for item in socket["ages"]}
    ages = []
    for item in manifest["ages"]:
        updated = by_age[item["key"]]
        ages.append({**item, **updated, "portraitHeads": item["heads"]})
    return {**manifest, "socket": True, "ages": ages}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    houses = build_houses()
    environment = build_environment()
    people = build_people()
    build_professions()
    build_special()
    build_secondary()
    manifest = {
        "frame": [64, 96],
        "ages": [
            {
                "key": key,
                "bodyHeight": BODY_HEIGHTS[index],
                "headHeight": HEAD_HEIGHTS[index],
                "heads": f"heads_{key}.png",
                "bodies": f"bodies_{key}.png",
                "headInfo": ANALYSIS[key]["heads"],
                "bodyInfo": ANALYSIS[key]["bodies"],
            }
            for index, key in enumerate(AGE_KEYS)
        ],
        "careers": {career: f"career_{career}.png" for career in CAREERS},
        "houses": {name: {"size": [image.width, image.height], "anchor": [56, 176]} for name, image in houses},
    }
    manifest = merge_socket_manifest(manifest)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_animation()
    validate_output()
    contact(houses, "houses.png", columns=6, scale=2)
    contact(environment, "environment.png", columns=3, scale=2)
    print(f"Kimi production preview: {len(houses)} houses, {len(environment)} layers, {len(people)} ages")


if __name__ == "__main__":
    main()
