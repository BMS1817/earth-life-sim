import json
import runpy
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "kimi" / "people"
OUT = ROOT / "shots" / "neck-socket-control"
ART = runpy.run_path(str(ROOT / "scripts" / "build_kimi_art.py"))
OFFSETS = (0, 0, 0, -1, -1, -1, 0, 0)
NECK_HEIGHTS = (4,)
HEAD_VISIBLE_NECK = (4, 4, 4, 3, 0, 2, 4, 4, 2, 2, 2, 2)
HEAD_X_OFFSETS = {4: 5}
FRONT_DETAIL_HEADS = {4: "scarf", 5: "hair", 11: "hair"}
HIDE_NECK_HEADS = {4}
NECK_WIDTH = 5
ANCHOR_COLORS = {
    "skullBase": (42, 169, 214, 255),
    "neck": (218, 65, 147, 255),
    "socket": (239, 142, 46, 255),
    "interior": (52, 196, 128, 255),
}


def runs(points):
    result = []
    for point in sorted(points):
        if not result or point > result[-1][-1] + 1:
            result.append([point])
        else:
            result[-1].append(point)
    return [(items[0], items[-1], len(items)) for items in result]


def is_skin(pixel, skin, tolerance=105):
    r, g, b, a = pixel
    if a == 0 or r <= g or g < b or r < 70:
        return False
    return skin is None or ((r - skin[0]) ** 2 + (g - skin[1]) ** 2 + (b - skin[2]) ** 2) ** 0.5 <= tolerance


def head_skin(head):
    counts = {}
    for r, g, b, a in head.getdata():
        if a and r > g and g > b and r >= 120 and r - b >= 70 and g - b >= 25 and r / max(g, 1) > 1.2:
            counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    skin = max(counts, key=counts.get) if counts else ART["analyze_head"](head)["skin"]
    return tuple(skin or ART["dominant_skin"](head) or (192, 128, 80))


def nearest_skin_run(head, y, center_x, skin, maximum=14):
    points = [x for x in range(head.width) if is_skin(head.getpixel((x, y)), skin)]
    valid = [item for item in runs(points) if 2 <= item[2] <= maximum and abs((item[0] + item[1]) / 2 - center_x) <= 8]
    if not valid:
        return None
    return min(valid, key=lambda item: abs((item[0] + item[1]) / 2 - center_x))


def skin_neck(head):
    skin = head_skin(head)
    box = head.getchannel("A").getbbox()
    center_x = (box[0] + box[2] - 1) / 2
    for y in range(head.height - 1, -1, -1):
        run = nearest_skin_run(head, y, center_x, skin, maximum=12)
        if run:
            left, right, width = run
            return {"x": (left + right) / 2, "y": y, "width": width, "detected": True, "skin": skin}
    return {"x": center_x, "y": box[3] - 1, "width": box[2] - box[0], "detected": False, "skin": skin}


def head_anchors(head):
    neck = skin_neck(head)
    skull_base = neck["y"]
    narrow_limit = max(8, min(10, neck["width"] + 4))
    for y in range(neck["y"] - 1, max(-1, neck["y"] - 18), -1):
        alpha_runs = [item for item in runs([x for x in range(head.width) if head.getpixel((x, y))[3]]) if item[2] >= 2]
        central = [item for item in alpha_runs if abs((item[0] + item[1]) / 2 - neck["x"]) <= 8]
        if not central:
            break
        center_run = min(central, key=lambda item: abs((item[0] + item[1]) / 2 - neck["x"]))
        right_face = any(item[0] > center_run[1] + 1 and item[0] <= neck["x"] + 14 for item in alpha_runs)
        if center_run[2] > narrow_limit or right_face:
            break
        skull_base = y
    tab_left = round(neck["x"]) - NECK_WIDTH // 2
    return {
        "skullBase": [round(neck["x"]), skull_base],
        "neckCenter": [round(neck["x"]), skull_base],
        "neckBottom": [round(neck["x"]), neck["y"]],
        "neckWidth": neck["width"],
        "tabLeft": tab_left,
        "skin": neck["skin"],
        "detected": neck["detected"],
    }


def normalize_neck(head, anchors):
    result = head.copy()
    pixels = result.load()
    left = anchors["tabLeft"]
    top = anchors["skullBase"][1]
    bottom = anchors["neckBottom"][1]
    skin = tuple(anchors["skin"])
    for y in range(top, result.height):
        run = nearest_skin_run(result, y, anchors["neckCenter"][0], skin) if y <= bottom else None
        if run:
            for x in range(run[0], run[1] + 1):
                if not left <= x < left + NECK_WIDTH:
                    pixels[x, y] = (0, 0, 0, 0)
        for x in range(left, left + NECK_WIDTH):
            if 0 <= x < result.width:
                pixels[x, y] = (*skin, 255)
    return result


def front_detail(source, anchors, kind):
    result = Image.new("RGBA", source.size, (0, 0, 0, 0))
    pixels = result.load()
    start = max(0, anchors["skullBase"][1] - 4)
    for y in range(start, source.height):
        for x in range(source.width):
            pixel = source.getpixel((x, y))
            if not pixel[3] or is_skin(pixel, anchors["skin"]):
                continue
            if kind == "hair" and x >= anchors["tabLeft"]:
                continue
            if kind == "scarf" and anchors["tabLeft"] <= x < anchors["tabLeft"] + NECK_WIDTH:
                continue
            pixels[x, y] = pixel
    return result


def front_color(image, anchors):
    counts = {}
    for y in range(max(0, anchors["skullBase"][1] - 12), image.height):
        for x in range(anchors["tabLeft"]):
            r, g, b, a = image.getpixel((x, y))
            if a and max(r, g, b) >= 140 and r - g < 55 and g - b < 80:
                counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    return max(counts, key=counts.get)


def prepare_head(source, anchors, index):
    result = normalize_neck(source, anchors)
    if index in HIDE_NECK_HEADS:
        pixels = result.load()
        left = anchors["tabLeft"]
        for y in range(anchors["skullBase"][1], result.height):
            for x in range(left, left + NECK_WIDTH):
                if 0 <= x < result.width:
                    pixels[x, y] = (0, 0, 0, 0)
    return result


def body_socket(body):
    box = body.getchannel("A").getbbox()
    y = box[1]
    alpha = [x for x in range(body.width) if body.getpixel((x, y))[3]]
    center = round((min(alpha) + max(alpha)) / 2)
    left = center - NECK_WIDTH // 2
    return {
        "socketTop": [center, y],
        "socketCenter": [center, y + 1],
        "interior": [left, y + 1, NECK_WIDTH, 1],
        "sourceWidth": len(alpha),
    }


def open_socket(body, socket):
    result = body.copy()
    pixels = result.load()
    left, y, width, height = socket["interior"]
    for row in range(y, y + height):
        for x in range(left, left + width):
            if 0 <= x < result.width and 0 <= row < result.height:
                pixels[x, row] = (0, 0, 0, 0)
    return result


def modules():
    heads_source = Image.open(SOURCE / "heads_neck_only_control_adult.png").convert("RGBA")
    heads = []
    for index in range(12):
        image = ART["fit"](ART["isolate_main"](ART["cell"](heads_source, 6, 2, index % 6, index // 6), margin=4), 64, ART["HEAD_HEIGHTS"][5])
        canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        canvas.paste(image, (0, 64 - image.height), image)
        anchors = head_anchors(canvas)
        detail_kind = FRONT_DETAIL_HEADS.get(index)
        front = front_detail(canvas, anchors, detail_kind) if detail_kind else None
        heads.append({
            "index": index,
            "image": prepare_head(canvas, anchors, index),
            "source": canvas,
            "anchors": anchors,
            "visibleNeck": HEAD_VISIBLE_NECK[index],
            "front": front,
            "frontKind": detail_kind,
            "frontColor": front_color(canvas, anchors) if index in HIDE_NECK_HEADS else None,
        })
    bodies = {}
    for kind, filename in (("base", "bodies_socket_control_adult.png"), ("medicine", "profession_bodies_socket_control_medicine_adult.png")):
        source = Image.open(SOURCE / filename).convert("RGBA")
        items = []
        for row in range(3):
            for column in range(6):
                image = ART["fit"](ART["isolate_main"](ART["cell"](source, 6, 3, column, row)), 64, ART["BODY_HEIGHTS"][5])
                canvas = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
                canvas.paste(image, (0, 96 - image.height), image)
                socket = body_socket(image)
                socket["socketTop"][1] += 96 - image.height
                socket["socketCenter"][1] += 96 - image.height
                socket["interior"][1] += 96 - image.height
                items.append({"image": open_socket(canvas, socket), "source": canvas, "socket": socket})
        bodies[kind] = items
    return heads, bodies


def assemble(head, body, visible_neck=4, offset=0, individual_x=True):
    visible_neck = head["visibleNeck"]
    socket_y = body["socket"]["socketTop"][1]
    x = round(body["socket"]["socketCenter"][0] - head["anchors"]["neckCenter"][0])
    if individual_x:
        x += HEAD_X_OFFSETS.get(head["index"], 0)
    base_y = socket_y + 1 - visible_neck - head["anchors"]["skullBase"][1]
    source_top = head["image"].getchannel("A").getbbox()[1]
    safe_base_y = max(base_y, 1 - source_top)
    y = max(safe_base_y + offset, 1 - source_top)
    person = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
    draw = ImageDraw.Draw(person)
    neck_x = body["socket"]["interior"][0] if head["index"] in HIDE_NECK_HEADS else x + head["anchors"]["tabLeft"]
    neck_top = y + head["anchors"]["skullBase"][1]
    neck_bottom = socket_y + 6
    fill = head["frontColor"] if head["index"] in HIDE_NECK_HEADS else head["anchors"]["skin"]
    draw.rectangle((neck_x, neck_top, neck_x + NECK_WIDTH - 1, neck_bottom), fill=(*fill, 255))
    person.paste(head["image"], (x, y), head["image"])
    person.paste(body["image"], (0, 0), body["image"])
    if head["front"]:
        person.paste(head["front"], (x, y), head["front"])
    anchors = {
        "skullBase": [x + head["anchors"]["skullBase"][0], y + head["anchors"]["skullBase"][1]],
        "neckCenter": [neck_x + NECK_WIDTH // 2, neck_top],
        "neckBottom": [neck_x + NECK_WIDTH // 2, neck_bottom],
        "socketTop": [body["socket"]["socketTop"][0], socket_y],
        "socketCenter": [body["socket"]["socketCenter"][0], socket_y + 1],
        "interior": body["socket"]["interior"],
    }
    return person, x, y, anchors


def components(person):
    alpha = person.getchannel("A")
    pixels = alpha.load()
    seen = set()
    sizes = []
    for y in range(person.height):
        for x in range(person.width):
            if (x, y) in seen or pixels[x, y] == 0:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            size = 0
            while stack:
                px, py = stack.pop()
                size += 1
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < person.width and 0 <= ny < person.height and (nx, ny) not in seen and pixels[nx, ny] != 0:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            sizes.append(size)
    return sorted(sizes, reverse=True)


def socket_fill(person, anchors, head):
    left, y, width, height = anchors["interior"]
    missing = []
    for row in range(y, y + height):
        for x in range(left, left + width):
            pixel = person.getpixel((x, row))
            valid = pixel[3] and (not is_skin(pixel, head["anchors"]["skin"]) or tuple(pixel[:3]) == tuple(head["frontColor"])) if head["index"] in HIDE_NECK_HEADS else is_skin(pixel, head["anchors"]["skin"])
            if not valid:
                missing.append([x, row, pixel])
    return missing


def contact(items, path, columns=6, scale=3, crop=None):
    source_width, source_height = (64, 96) if crop is None else (crop[2] - crop[0], crop[3] - crop[1])
    cell_width = source_width + 16
    cell_height = source_height + 20
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (243, 236, 223, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (label, image) in enumerate(items):
        if crop:
            image = image.crop(crop)
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        draw.text((x + 2, y + 2), label, fill=(52, 58, 69, 255))
        sheet.paste(image, (x + 8, y + 16), image)
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST).save(path)


def head_overlay(head):
    image = head["source"].copy()
    draw = ImageDraw.Draw(image)
    anchors = head["anchors"]
    x = anchors["neckCenter"][0]
    skull_y = anchors["skullBase"][1]
    bottom_y = anchors["neckBottom"][1]
    draw.line((x - 5, skull_y, x + 5, skull_y), fill=ANCHOR_COLORS["skullBase"])
    draw.line((x, skull_y, x, bottom_y), fill=ANCHOR_COLORS["neck"])
    draw.point((x, bottom_y), fill=ANCHOR_COLORS["socket"])
    return image


def body_overlay(body):
    image = body["source"].copy()
    draw = ImageDraw.Draw(image)
    socket = body["socket"]
    x, y = socket["socketTop"]
    left, inner_y, width, height = socket["interior"]
    draw.line((x - 6, y, x + 6, y), fill=ANCHOR_COLORS["socket"])
    draw.line((x, y, x, y + 7), fill=ANCHOR_COLORS["neck"])
    draw.rectangle((left, inner_y, left + width - 1, inner_y + height - 1), outline=ANCHOR_COLORS["interior"])
    return image


def assembled_overlay(person, anchors):
    image = person.copy()
    draw = ImageDraw.Draw(image)
    skull_x, skull_y = anchors["skullBase"]
    neck_x, neck_y = anchors["neckCenter"]
    _, neck_bottom = anchors["neckBottom"]
    socket_x, socket_y = anchors["socketTop"]
    left, inner_y, width, height = anchors["interior"]
    draw.line((skull_x - 5, skull_y, skull_x + 5, skull_y), fill=ANCHOR_COLORS["skullBase"])
    draw.line((neck_x, neck_y, neck_x, neck_bottom), fill=ANCHOR_COLORS["neck"])
    draw.point((socket_x, socket_y), fill=ANCHOR_COLORS["socket"])
    draw.rectangle((left, inner_y, left + width - 1, inner_y + height - 1), outline=ANCHOR_COLORS["interior"])
    return image


def source_sheets(heads, bodies):
    contact([(f"{('F' if index < 6 else 'M')}{index % 6}", head["source"]) for index, head in enumerate(heads)], OUT / "source-heads.png", columns=6, scale=6, crop=(12, 20, 52, 64))
    contact([(f"{('F' if index < 6 else 'M')}{index % 6}", head_overlay(head)) for index, head in enumerate(heads)], OUT / "source-heads-anchors.png", columns=6, scale=8, crop=(12, 20, 52, 64))
    for kind in ("base", "medicine"):
        contact([(f"{index // 6}:{index % 6}", body["source"].crop((12, 24, 52, 52))) for index, body in enumerate(bodies[kind])], OUT / f"source-bodies-{kind}.png", columns=6, scale=5)
        contact([(f"{index // 6}:{index % 6}", body_overlay(body).crop((12, 24, 52, 52))) for index, body in enumerate(bodies[kind])], OUT / f"source-bodies-{kind}-anchors.png", columns=6, scale=8)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    heads, bodies = modules()
    source_sheets(heads, bodies)
    report = {
        "heads": len(heads),
        "baseBodies": len(bodies["base"]),
        "medicineBodies": len(bodies["medicine"]),
        "neckWidth": NECK_WIDTH,
        "combinations": 0,
        "frames": 0,
        "headAnchors": [item["anchors"] for item in heads],
        "baseSockets": [item["socket"] for item in bodies["base"]],
        "medicineSockets": [item["socket"] for item in bodies["medicine"]],
        "variants": {},
    }
    for visible_neck in NECK_HEIGHTS:
        variant = OUT / f"neck-{visible_neck}px"
        variant.mkdir(parents=True, exist_ok=True)
        result = {"visibleNeck": visible_neck, "combinations": 0, "frames": 0, "clipped": [], "pivot": [], "disconnected": [], "largeHorizontalShifts": [], "socketSkin": [], "neckTaper": []}
        result["safetyAdjustments"] = []
        for head_index, head in enumerate(heads):
            base_y = 34 - head["visibleNeck"] - head["anchors"]["skullBase"][1]
            reduction = max(0, 1 - head["image"].getchannel("A").getbbox()[1] - base_y)
            if reduction:
                result["safetyAdjustments"].append({"head": head_index, "reducedBy": reduction, "actualVisibleNeck": head["visibleNeck"] - reduction})
        result["headVisibleNeck"] = [head["visibleNeck"] for head in heads]
        result["frontLayers"] = {str(index): {"kind": head["frontKind"], "pixels": head["front"].getchannel("A").getbbox() is not None and sum(1 for value in head["front"].getchannel("A").getdata() if value)} for index, head in enumerate(heads) if head["front"]}
        for kind, body_items in bodies.items():
            for head_index, head in enumerate(heads):
                for body_index, body in enumerate(body_items):
                    bottom = None
                    for frame, offset in enumerate(OFFSETS):
                        person, shift_x, _, anchors = assemble(head, body, visible_neck, offset)
                        key = f"{kind}:head-{head_index}:body-{body_index}:frame-{frame}"
                        box = person.getchannel("A").getbbox()
                        pixels = person.getchannel("A").load()
                        if any(pixels[x, 0] or pixels[x, 95] for x in range(64)) or any(pixels[0, y] or pixels[63, y] for y in range(96)):
                            result["clipped"].append(key)
                        if bottom is None:
                            bottom = box[3]
                        elif box[3] != bottom:
                            result["pivot"].append(key)
                        sizes = components(person)
                        total = sum(sizes)
                        significant = [size for size in sizes if size >= max(4, total * 0.12)]
                        if len(significant) > 1:
                            result["disconnected"].append({"key": key, "components": sizes[:6]})
                        if frame == 0 and abs(shift_x) > 8:
                            result["largeHorizontalShifts"].append({"key": key, "shiftX": shift_x})
                        missing = socket_fill(person, anchors, head)
                        if missing:
                            result["socketSkin"].append({"key": key, "missing": missing})
                        if 6 <= head_index <= 10:
                            neck_x = anchors["neckCenter"][0]
                            for row in range(anchors["skullBase"][1], anchors["socketTop"][1]):
                                bad = [x for x in range(neck_x - 2, neck_x + 3) if not is_skin(person.getpixel((x, row)), head["anchors"]["skin"])]
                                if bad:
                                    result["neckTaper"].append({"key": key, "row": row, "pixels": bad})
                        result["frames"] += 1
                    result["combinations"] += 1
        for kind in ("base", "medicine"):
            body = bodies[kind][7]
            items = []
            closeups = []
            overlays = []
            for index, head in enumerate(heads):
                person, _, _, anchors = assemble(head, body, visible_neck)
                label = f"{('F' if index < 6 else 'M')}{index % 6}"
                items.append((label, person))
                closeups.append((label, person))
                overlays.append((label, assembled_overlay(person, anchors)))
            contact(items, variant / f"heads-{kind}.png")
            contact(closeups, variant / f"neck-closeups-{kind}.png", columns=6, scale=8, crop=(12, 0, 52, 52))
            contact(overlays, variant / f"neck-anchors-{kind}.png", columns=6, scale=8, crop=(12, 0, 52, 52))
            body_items = []
            for index, body in enumerate(bodies[kind]):
                person, _, _, _ = assemble(heads[0], body, visible_neck)
                body_items.append((f"{index // 6}:{index % 6}", person))
            contact(body_items, variant / f"bodies-{kind}.png")
        comparison = []
        for label, head_index, individual_x in (("F0 reference", 0, True), ("F4 before", 4, False), ("F4 after", 4, True)):
            person, _, _, _ = assemble(heads[head_index], bodies["medicine"][7], visible_neck, individual_x=individual_x)
            comparison.append((label, person))
        contact(comparison, variant / "f4-axis-comparison.png", columns=3, scale=8, crop=(12, 0, 52, 52))
        for kind in ("base", "medicine"):
            f4_bodies = []
            for index, body in enumerate(bodies[kind]):
                person, _, _, _ = assemble(heads[4], body, visible_neck)
                f4_bodies.append((f"{index // 6}:{index % 6}", person))
            contact(f4_bodies, variant / f"f4-bodies-{kind}.png")
        frames = []
        gif_frames = []
        for index, offset in enumerate(OFFSETS):
            person, _, _, _ = assemble(heads[0], bodies["medicine"][7], visible_neck, offset)
            frames.append((str(index + 1), person))
            gif_frames.append(person.resize((256, 384), Image.Resampling.NEAREST))
        contact(frames, variant / "animation.png", columns=8)
        (gif_frames * 3)[0].save(variant / "animation.gif", save_all=True, append_images=(gif_frames * 3)[1:], duration=120, loop=0, disposal=2, transparency=0)
        result["passed"] = result["combinations"] == 432 and result["frames"] == 3456 and not any(result[key] for key in ("clipped", "pivot", "disconnected", "largeHorizontalShifts", "socketSkin", "neckTaper"))
        report["variants"][str(visible_neck)] = result
        report["combinations"] += result["combinations"]
        report["frames"] += result["frames"]
    report["expected"] = {"combinations": 432 * len(NECK_HEIGHTS), "frames": 3456 * len(NECK_HEIGHTS)}
    report["passed"] = report["combinations"] == report["expected"]["combinations"] and report["frames"] == report["expected"]["frames"] and all(item["passed"] for item in report["variants"].values())
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"combinations": report["combinations"], "frames": report["frames"], "passed": report["passed"], "variants": {key: {name: (len(value) if isinstance(value, list) else value) for name, value in item.items() if name in ("clipped", "pivot", "disconnected", "largeHorizontalShifts", "socketSkin", "neckTaper", "passed")} for key, item in report["variants"].items()}}, ensure_ascii=False))
    print("Skull bases:", [item["anchors"]["skullBase"][1] for item in heads])
    print("Neck bottoms:", [item["anchors"]["neckBottom"][1] for item in heads])


if __name__ == "__main__":
    main()
