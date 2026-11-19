import json
import runpy
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "kimi" / "people"
OUT = ROOT / "public" / "art" / "kimi" / "socket"
REVIEW = ROOT / "shots" / "socket-production"
ART = runpy.run_path(str(ROOT / "scripts" / "build_kimi_art.py"))
CONTROL = runpy.run_path(str(ROOT / "scripts" / "audit_neck_socket_control.py"))
AGE_KEYS = ART["AGE_KEYS"]
CAREERS = ART["CAREERS"]
OFFSETS = CONTROL["OFFSETS"]
BASE_ONLY = "--base" in sys.argv


def control_set(name, value):
    CONTROL[name] = value
    CONTROL["assemble"].__globals__[name] = value


def save(image, name):
    path = OUT / f"{name}.png"
    image.save(path, optimize=True)
    return image


def contact(items, path, columns=6, scale=3):
    cell_width = 80
    cell_height = 116
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (243, 236, 223, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (label, image) in enumerate(items):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        draw.text((x + 2, y + 2), label, fill=(52, 58, 69, 255))
        sheet.paste(image, (x + 8, y + 16), image)
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST).save(path)


def age_visible_neck(age_index, head_index):
    value = CONTROL["HEAD_VISIBLE_NECK"][head_index]
    if age_index <= 1:
        return min(value, 2)
    if age_index <= 3:
        return min(value, 3)
    return value


def build_heads(age_index):
    age_key = AGE_KEYS[age_index]
    control_set("NECK_WIDTH", 4 if age_index < 4 else 5)
    filename = "heads_neck_only_control_adult.png" if age_key == "05_adult" else f"heads_neck_only_{age_key}.png"
    source = Image.open(SOURCE / filename).convert("RGBA")
    sheet = Image.new("RGBA", (384, 128), (0, 0, 0, 0))
    front_sheet = Image.new("RGBA", (384, 128), (0, 0, 0, 0))
    items = []
    info = []
    control_set("HIDE_NECK_HEADS", {4} if age_index >= 3 else set())
    control_set("HEAD_X_OFFSETS", {4: 5} if age_index >= 3 else {})
    for index in range(12):
        image = ART["fit"](ART["isolate_main"](ART["cell"](source, 6, 2, index % 6, index // 6), margin=4), 64, ART["HEAD_HEIGHTS"][age_index])
        canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        canvas.paste(image, (0, 64 - image.height), image)
        anchors = CONTROL["head_anchors"](canvas)
        prepared = CONTROL["prepare_head"](canvas, anchors, index)
        detail_kind = CONTROL["FRONT_DETAIL_HEADS"].get(index)
        if index == 4 and age_index < 3:
            detail_kind = None
        front = CONTROL["front_detail"](canvas, anchors, detail_kind) if detail_kind else None
        x = (index % 6) * 64
        y = (index // 6) * 64
        sheet.paste(prepared, (x, y), prepared)
        if front:
            front_sheet.paste(front, (x, y), front)
        items.append({
            "index": index,
            "image": prepared,
            "source": canvas,
            "anchors": anchors,
            "visibleNeck": age_visible_neck(age_index, index),
            "front": front,
            "frontKind": detail_kind,
            "frontColor": CONTROL["front_color"](canvas, anchors) if index in CONTROL["HIDE_NECK_HEADS"] else None,
        })
        analysis = ART["analyze_head"](prepared)
        info.append({**analysis, **anchors, "visibleNeck": items[-1]["visibleNeck"], "xOffset": CONTROL["HEAD_X_OFFSETS"].get(index, 0), "hideNeck": index in CONTROL["HIDE_NECK_HEADS"], "frontKind": detail_kind, "frontColor": items[-1]["frontColor"]})
    save(ART["opaque"](sheet), f"heads_{age_key}")
    save(ART["opaque"](front_sheet), f"front_{age_key}")
    return items, info


def body_source(age_key, career):
    filename = f"profession_bodies_socket_{career}_{age_key}.png" if career else f"bodies_socket_{age_key}.png"
    if career == "medicine" and age_key == "05_adult":
        filename = "profession_bodies_socket_control_medicine_adult.png"
    if career is None and age_key == "05_adult":
        filename = "bodies_socket_control_adult.png"
    path = SOURCE / filename
    versions = [path.with_name(f"{path.stem}_v{version}{path.suffix}") for version in range(2, 10)]
    existing = [candidate for candidate in versions if candidate.exists()]
    return existing[-1].name if existing else filename


def build_bodies(age_index, career=None):
    age_key = AGE_KEYS[age_index]
    control_set("NECK_WIDTH", 4 if age_index < 4 else 5)
    source = Image.open(SOURCE / body_source(age_key, career)).convert("RGBA")
    sheet = Image.new("RGBA", (384, 288), (0, 0, 0, 0))
    items = []
    info = []
    for index in range(18):
        row = index // 6
        column = index % 6
        image = ART["fit"](ART["isolate_main"](ART["cell"](source, 6, 3, column, row)), 64, ART["BODY_HEIGHTS"][age_index])
        canvas = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
        canvas.paste(image, (0, 96 - image.height), image)
        socket = CONTROL["body_socket"](image)
        socket["socketTop"][1] += 96 - image.height
        socket["socketCenter"][1] += 96 - image.height
        socket["interior"][1] += 96 - image.height
        prepared = CONTROL["open_socket"](canvas, socket)
        sheet.paste(prepared, (column * 64, row * 96), prepared)
        items.append({"image": prepared, "source": canvas, "socket": socket})
        info.append({**ART["analyze_body"](prepared), **socket})
    name = f"bodies_{age_key}" if career is None else f"career_{career}_{age_key}"
    save(ART["opaque"](sheet), name)
    return items, info


def audit_frame(report, person, key, bottom):
    box = person.getchannel("A").getbbox()
    pixels = person.getchannel("A").load()
    if any(pixels[x, 0] or pixels[x, 95] for x in range(64)) or any(pixels[0, y] or pixels[63, y] for y in range(96)):
        report["clipped"].append(key)
    if bottom is not None and box[3] != bottom:
        report["pivot"].append({"key": key, "expected": bottom, "actual": box[3]})
    sizes = CONTROL["components"](person)
    significant = [size for size in sizes if size >= max(4, sum(sizes) * 0.12)]
    if len(significant) > 1:
        report["disconnected"].append({"key": key, "components": sizes[:6]})
    return box[3]


def audit_age(age_index, heads, base_bodies, career_bodies):
    report = {"age": AGE_KEYS[age_index], "combinations": 0, "frames": 0, "clipped": [], "pivot": [], "disconnected": [], "socketFill": []}
    groups = [("base", base_bodies)] + list(career_bodies.items())
    for kind, bodies in groups:
        for head in heads:
            for body in bodies:
                bottom = None
                for frame, offset in enumerate(OFFSETS):
                    person, _, _, anchors = CONTROL["assemble"](head, body, 4, offset)
                    key = f"{kind}:head-{head['index']}:body-{bodies.index(body)}:frame-{frame}"
                    bottom = audit_frame(report, person, key, bottom)
                    missing = CONTROL["socket_fill"](person, anchors, head)
                    if missing:
                        report["socketFill"].append({"key": key, "missing": missing})
                    report["frames"] += 1
                report["combinations"] += 1
    report["passed"] = not any(report[key] for key in ("clipped", "pivot", "disconnected", "socketFill"))
    return report


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    manifest = {"frame": [64, 96], "socket": True, "complete": not BASE_ONLY, "ages": [], "careers": list(CAREERS)}
    report = {"combinations": 0, "frames": 0, "ages": [], "passed": True}
    for age_index, age_key in enumerate(AGE_KEYS):
        heads, head_info = build_heads(age_index)
        bodies, body_info = build_bodies(age_index)
        career_bodies = {}
        if not BASE_ONLY and age_index >= 4:
            for career in CAREERS:
                career_bodies[career], _ = build_bodies(age_index, career)
        age_report = audit_age(age_index, heads, bodies, career_bodies)
        report["ages"].append(age_report)
        report["combinations"] += age_report["combinations"]
        report["frames"] += age_report["frames"]
        report["passed"] = report["passed"] and age_report["passed"]
        manifest["ages"].append({
            "key": age_key,
            "heads": f"socket/heads_{age_key}.png",
            "front": f"socket/front_{age_key}.png",
            "bodies": f"socket/bodies_{age_key}.png",
            "headInfo": head_info,
            "bodyInfo": body_info,
            "neckWidth": 4 if age_index < 4 else 5,
            "careers": {career: f"socket/career_{career}_{age_key}.png" for career in CAREERS} if not BASE_ONLY and age_index >= 4 else {},
        })
        items = []
        for index, head in enumerate(heads):
            person, _, _, _ = CONTROL["assemble"](head, bodies[7])
            items.append((f"{('F' if index < 6 else 'M')}{index % 6}", person))
        contact(items, REVIEW / f"age-{age_key}.png")
        frames = []
        for offset in OFFSETS:
            frame, _, _, _ = CONTROL["assemble"](heads[0], bodies[7], 4, offset)
            background = Image.new("RGBA", (128, 192), (243, 236, 223, 255))
            background.paste(frame.resize((128, 192), Image.Resampling.NEAREST), (0, 0))
            frames.append(background)
        (frames * 3)[0].save(REVIEW / f"animation-{age_key}.gif", save_all=True, append_images=(frames * 3)[1:], duration=120, loop=0, disposal=2)
        report["baseOnly"] = BASE_ONLY
        (REVIEW / "report.partial.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"age": age_key, "combinations": age_report["combinations"], "frames": age_report["frames"], "passed": age_report["passed"]}), flush=True)
    report["baseOnly"] = BASE_ONLY
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (REVIEW / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"combinations": report["combinations"], "frames": report["frames"], "passed": report["passed"], "baseOnly": BASE_ONLY}))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
