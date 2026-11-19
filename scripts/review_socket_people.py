import json
import runpy
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART_ROOT = ROOT / "public" / "art" / "kimi"
OUT = ROOT / "shots" / "socket-production" / "careers"
CONTROL = runpy.run_path(str(ROOT / "scripts" / "audit_neck_socket_control.py"))
BUILD = runpy.run_path(str(ROOT / "scripts" / "build_socket_people.py"))
ART = BUILD["ART"]


def control_set(name, value):
    CONTROL[name] = value
    CONTROL["assemble"].__globals__[name] = value


def heads_for(assets):
    sheet = Image.open(ART_ROOT / assets["heads"]).convert("RGBA")
    front_sheet = Image.open(ART_ROOT / assets["front"]).convert("RGBA")
    result = []
    for index, info in enumerate(assets["headInfo"]):
        front = ART["cell"](front_sheet, 6, 2, index % 6, index // 6) if info.get("frontKind") else None
        result.append({"index": index, "image": ART["cell"](sheet, 6, 2, index % 6, index // 6), "anchors": info, "visibleNeck": info["visibleNeck"], "front": front, "frontKind": info.get("frontKind"), "frontColor": info.get("frontColor")})
    return result


def bodies_for(assets, career=None):
    filename = assets["careers"][career] if career else assets["bodies"]
    sheet = Image.open(ART_ROOT / filename).convert("RGBA")
    info = assets["bodyInfo"]
    return [{"image": ART["cell"](sheet, 6, 3, index % 6, index // 6), "socket": info[index]} for index in range(18)]


def configure(assets):
    control_set("NECK_WIDTH", assets["neckWidth"])
    control_set("HEAD_X_OFFSETS", {index: info.get("xOffset", 0) for index, info in enumerate(assets["headInfo"]) if info.get("xOffset", 0)})
    control_set("HIDE_NECK_HEADS", {index for index, info in enumerate(assets["headInfo"]) if info.get("hideNeck")})


def main():
    global MANIFEST
    MANIFEST = json.loads((ART_ROOT / "socket" / "manifest.json").read_text(encoding="utf-8"))
    if not MANIFEST.get("complete"):
        raise SystemExit("Socket manifest is not complete")
    OUT.mkdir(parents=True, exist_ok=True)
    for assets in MANIFEST["ages"]:
        if not assets["careers"]:
            continue
        configure(assets)
        heads = heads_for(assets)
        for career, filename in assets["careers"].items():
            bodies = bodies_for(assets, career)
            items = []
            for index, head in enumerate(heads):
                person, _, _, _ = CONTROL["assemble"](head, bodies[7])
                items.append((f"{('F' if index < 6 else 'M')}{index % 6}", person))
            BUILD["contact"](items, OUT / f"{career}-{assets['key']}.png")
    adult = MANIFEST["ages"][5]
    configure(adult)
    head = heads_for(adult)[0]
    for career in MANIFEST["careers"]:
        bodies = bodies_for(adult, career)
        items = []
        for index, body in enumerate(bodies):
            person, _, _, _ = CONTROL["assemble"](head, body)
            items.append((f"{index // 6}:{index % 6}", person))
        BUILD["contact"](items, OUT / f"{career}-bodies.png")
        frames = []
        for offset in CONTROL["OFFSETS"]:
            person, _, _, _ = CONTROL["assemble"](head, bodies[7], 4, offset)
            background = Image.new("RGBA", (128, 192), (243, 236, 223, 255))
            background.paste(person.resize((128, 192), Image.Resampling.NEAREST), (0, 0))
            frames.append(background)
        (frames * 3)[0].save(OUT / f"{career}.gif", save_all=True, append_images=(frames * 3)[1:], duration=120, loop=0, disposal=2)
    print(json.dumps({"careerAgeSheets": 35, "bodySheets": 7, "gifs": 7, "out": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
