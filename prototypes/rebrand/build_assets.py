from pathlib import Path
import json
import shutil
import subprocess
import sys
from PIL import Image

root = Path(__file__).resolve().parents[2]
production = "--production" in sys.argv
out = root / "public/art/rebrand" if production else Path(__file__).resolve().parent / "assets"
out.mkdir(parents=True, exist_ok=True)
review = root / ".tools/style-review"
excluded = {"age-matrix.png", "house-matrix.png", "hobby-reference-matrix.png", "house-temperate-scene-preview.png"}
for name in excluded:
    if (out / name).exists():
        (out / name).unlink()
for source in list(review.glob("age-*.png")) + list(review.glob("house-*.png")) + list(review.glob("interior-*-128.png")) + list(review.glob("hobby-*.png")) + list(review.glob("object-*.png")) + [review / "bicycle-icon-32.png", review / "war-truck-64.png", review / "war-soldier-24.png", review / "war-debris-48.png"]:
    if source.name in excluded or source.name.startswith("hobby-memorial-preview"):
        if (out / source.name).exists():
            (out / source.name).unlink()
        continue
    shutil.copy2(source, out / source.name)
for source in [root / ".tools/asset-downloads/ph64-electronics/computer-32.png", root / ".tools/asset-downloads/small-city-cars/car-memorial-32.png", root / ".tools/asset-downloads/smoke-fire-particle/war-smoke-48.png"]:
    shutil.copy2(source, out / source.name)

village = Image.new("RGBA", (576, 324))
for name in ("Village landscape Free Pixel Art Background1.png", "Village landscape Free Pixel Art Background2.png", "Village landscape Free Pixel Art Background3.png"):
    village.alpha_composite(Image.open(root / ".tools/asset-downloads/village-landscape/extracted" / name).convert("RGBA"))
village.crop((0, 0, 256, 192)).save(out / "bg-temperate.png")
winter_root = root / ".tools/asset-downloads/winter-mountain/extracted"
winter = Image.new("RGBA", (576, 324))
for name in ("Plan 1.png", "Plan 2.png", "Plan 3.png", "Plan 4.png", "Plan 5.png", "background 1.png"):
    winter.alpha_composite(Image.open(winter_root / name).convert("RGBA"))
winter.crop((0, 0, 256, 192)).save(out / "bg-north.png")
desert = Image.open(root / ".tools/asset-downloads/desert-clean/Desert%20Clean.png").convert("RGBA").crop((352, 158, 928, 482))
desert.crop((0, 0, 256, 192)).save(out / "bg-tropics.png")

audio_out = out / "audio"
audio_out.mkdir(exist_ok=True)
if production:
    subprocess.run([
        "D:/Clode/Tools/ffmpeg/bin/ffmpeg.exe", "-hide_banner", "-y",
        "-i", str(root / ".tools/asset-audio/peaceful-village/peaceful-village-72s-preview.ogg"),
        "-c:a", "libvorbis", "-q:a", "5", str(audio_out / "music.ogg"),
    ], check=True, capture_output=True)
else:
    shutil.copy2(root / ".tools/asset-audio/peaceful-village/peaceful-village-72s-preview.ogg", audio_out / "music.ogg")
signals = {
    "choice": "confirmation_001.ogg",
    "year": "maximize_001.ogg",
    "inherit": "confirmation_004.ogg",
    "button": "click_001.ogg",
    "menu": "open_001.ogg",
    "favorite": "pluck_001.ogg",
    "error": "error_001.ogg",
    "death": "bong_001.ogg",
}
for name, filename in signals.items():
    shutil.copy2(root / ".tools/asset-audio/interface-sounds/extracted/candidates" / filename, audio_out / f"{name}.ogg")

manifest = {
    "scope": "isolated-rebrand-preview",
    "production": False,
    "files": sorted([path.name for path in out.glob("*.png")] + [f"audio/{path.name}" for path in audio_out.glob("*.ogg")]),
    "backgrounds": {climate: f"bg-{climate}.png" for climate in ("north", "temperate", "tropics")},
    "rooms": {climate: f"interior-{climate}-128.png" for climate in ("north", "temperate", "tropics")},
    "ages": [f"age-{index:02d}-{name}.png" for index, name in enumerate(("infant", "early", "child", "teen", "young", "adult", "mature", "senior", "elder"))],
    "houses": {
        f"house-{climate}-{wealth}{suffix}": {"size": [96, 80], "anchor": [192, 160]}
        for climate in ("north", "temperate", "tropics")
        for wealth in ("poor", "mid", "rich")
        for suffix in ("", "-damaged")
    },
    "audio": {"music": "audio/music.ogg", "signals": {name: f"audio/{name}.ogg" for name in signals}},
}
(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
shutil.copy2(root / "assets/asset-manifest.json", out / "provenance.json")
print(f"Built {len(list(out.glob('*.png')))} rebrand PNGs and {len(signals) + 1} audio files in {out}")
