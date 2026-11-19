import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art" / "kimi"
OUT = ROOT / "shots" / "art-static-audit"


def rgba_distance(first, second):
    return sum(abs(first[channel] - second[channel]) for channel in range(4)) / 4


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {
        "files": 0,
        "totalBytes": 0,
        "badAlpha": [],
        "empty": [],
        "spriteEdgeContacts": [],
        "backgroundHoles": [],
        "fullBackgroundCoverage": {},
        "textureCoverage": {},
        "seamMetrics": {},
    }
    for path in sorted(ART.rglob("*.png")):
        name = path.relative_to(ART).as_posix()
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        histogram = alpha.histogram()
        values = {index for index, count in enumerate(histogram) if count}
        coverage = histogram[255] / (image.width * image.height)
        if not values:
            report["empty"].append(name)
        if any(value not in (0, 255) for value in values):
            report["badAlpha"].append(name)
        box = alpha.getbbox()
        if name.startswith(("heads_", "bodies_", "career_", "house_", "war_", "person_", "object_", "socket/heads_", "socket/bodies_", "socket/career_", "socket/front_")):
            connector_bottom = box and box[3] == image.height and name.startswith(("socket/heads_", "socket/front_"))
            if box and (box[0] == 0 or box[1] == 0 or box[2] == image.width or (box[3] == image.height and not connector_bottom)):
                report["spriteEdgeContacts"].append({"name": name, "bbox": box})
        if name.startswith(("room_", "dream_", "portrait_", "politics_city")):
            report["fullBackgroundCoverage"][name] = coverage
            if coverage != 1:
                report["backgroundHoles"].append({"name": name, "coverage": coverage})
        if name.startswith("texture_"):
            report["textureCoverage"][name] = coverage
        if name.startswith("bg_") and not name.endswith("_sky.png"):
            pixels = image.load()
            border = sum(rgba_distance(pixels[0, y], pixels[image.width - 1, y]) for y in range(image.height)) / image.height
            internal = []
            for x in range(1, image.width):
                internal.append(sum(rgba_distance(pixels[x, y], pixels[x - 1, y]) for y in range(image.height)) / image.height)
            average = sum(internal) / len(internal)
            report["seamMetrics"][name] = {
                "sourceBorderDifference": round(border, 3),
                "sourceInternalDifference": round(average, 3),
                "renderedJoin": "exact mirrored edge",
            }
        report["files"] += 1
        report["totalBytes"] += path.stat().st_size
    report["passed"] = not any(report[key] for key in ("badAlpha", "empty", "spriteEdgeContacts", "backgroundHoles"))
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key in ("files", "totalBytes", "badAlpha", "empty", "spriteEdgeContacts", "backgroundHoles", "passed")}, ensure_ascii=False))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
