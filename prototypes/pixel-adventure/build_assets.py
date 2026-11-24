from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / ".tools/asset-downloads/kenney-ui-pack-pixel-adventure/extracted/Tiles/Large tiles/Thick outline"
OUT = ROOT / "prototypes/pixel-adventure/assets"

PALETTE = {
    (255, 241, 210): "#fff4d6",
    (109, 75, 39): "#5d4a36",
    (163, 112, 58): "#8a653c",
    (197, 135, 71): "#b78b52",
    (232, 208, 172): "#e6d2ac",
    (81, 95, 107): "#4b3d51",
    (119, 141, 159): "#7b668c",
    (148, 175, 198): "#b7a6c4",
}

SECTORS = {
    "tradition": {"dark": "#76552f", "base": "#b08a45", "light": "#f3e7c8", "raised": "#fff5da"},
    "change": {"dark": "#38556f", "base": "#6e92b5", "light": "#e1edf7", "raised": "#f4f8ff"},
    "bonds": {"dark": "#6f4058", "base": "#b87d99", "light": "#f3e0e8", "raised": "#fff0f5"},
    "self": {"dark": "#533b6d", "base": "#9678b5", "light": "#e9e1f3", "raised": "#f7f2ff"},
}


def rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def recolor(source_name, output_name, replacements):
    with Image.open(SOURCE / source_name) as source:
        image = source.convert("RGBA")
    pixels = []
    for red, green, blue, alpha in image.get_flattened_data():
        if alpha == 0:
            pixels.append((0, 0, 0, 0))
            continue
        color = replacements.get((red, green, blue))
        if color is None:
            raise ValueError(f"Unmapped color {(red, green, blue)} in {source_name}")
        pixels.append((*rgb(color), 255))
    image.putdata(pixels)
    image.save(OUT / output_name)


def sector_palette(sector, source):
    colors = SECTORS[sector]
    accent_dark = (59, 104, 145) if source == "change" else (82, 135, 56) if source == "bonds" else (142, 63, 56)
    accent_base = (207, 94, 83) if source == "tradition" else (92, 162, 224) if source == "change" else (114, 184, 78)
    if sector == "self":
        accent_dark, accent_base = (142, 63, 56), (207, 94, 83)
    return {
        accent_dark: colors["dark"],
        accent_base: colors["base"],
        (148, 175, 198): colors["light"],
        (162, 192, 217): colors["raised"],
        (100, 118, 133): colors["dark"],
        (135, 159, 180): colors["base"],
        (128, 152, 172): colors["dark"],
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    recolor("tile_0006.png", "panel.png", PALETTE)
    recolor("tile_0018.png", "card.png", PALETTE)
    recolor("tile_0000.png", "button.png", PALETTE)
    recolor("tile_0019.png", "button-active.png", PALETTE)
    for sector, source in (("tradition", "tradition"), ("change", "change"), ("bonds", "bonds"), ("self", "self")):
        recolor(f"tile_00{'33' if sector in ('tradition', 'self') else '34' if sector == 'bonds' else '35'}.png", f"choice-{sector}.png", sector_palette(sector, source))
    recolor("tile_0069.png", "banner.png", {
        (148, 175, 198): "#fff4d6",
        (142, 63, 56): "#5d4a36",
        (226, 102, 91): "#9678b5",
        (255, 132, 118): "#b7a6c4",
        (119, 141, 159): "#8a653c",
        (199, 89, 80): "#76552f",
    })
    license_metadata = {
        "name": "Earth UI prototype components derived from UI Pack - Pixel Adventure",
        "author": "Kenney",
        "source_url": "https://kenney.nl/assets/ui-pack-pixel-adventure",
        "license": "CC0 1.0",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "source_sha256": "0b0ed4802ebcfff5e44e370f394baa1d751862a5a4a7612ac4ce84e85faa0627",
        "changes": "Exact RGB palette substitution for Earth; original geometry and binary alpha retained; no resizing.",
        "attribution_required": False,
    }
    (OUT / "kenney-license.json").write_text(json.dumps(license_metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    names = ["panel", "card", "button", "button-active", "choice-tradition", "choice-change", "choice-bonds", "choice-self", "banner"]
    scale = 4
    cell_w, cell_h = 160, 172
    sheet = Image.new("RGB", (cell_w * 3, cell_h * 3), "#2e3a44")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    for index, name in enumerate(names):
        with Image.open(OUT / f"{name}.png") as image:
            enlarged = image.resize((128, 128), Image.Resampling.NEAREST)
        x, y = (index % 3) * cell_w, (index // 3) * cell_h
        draw.rectangle((x + 4, y + 4, x + 156, y + 140), fill="#f3ecdf")
        sheet.paste(enlarged, (x + 16, y + 8), enlarged)
        draw.text((x + 10, y + 146), name, font=font, fill="#fff4d6")
    sheet.save(ROOT / "prototypes/pixel-adventure/component-preview.png")
    print(f"Generated {len(names)} components in {OUT}")


if __name__ == "__main__":
    main()
