from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RELEASE = ROOT / "release"
SHOTS = ROOT / "shots" / "rebrand-production"
FONT = ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"
DARK = "#15131d"
PANEL = "#201c2a"
GOLD = "#e0b85c"
TEXT = "#f6edda"
MUTED = "#b9adbe"

RELEASE.mkdir(exist_ok=True)
(RELEASE / "screenshots").mkdir(exist_ok=True)
scene = Image.open(ROOT / ".tools/asset-downloads/village-landscape/pilot-scene.png").convert("RGB")
social = scene.resize((1728, 972), Image.Resampling.NEAREST)
social_canvas = Image.new("RGB", (1920, 1080), "#f3e7cf")
social_canvas.paste(social, (96, 54))
draw = ImageDraw.Draw(social_canvas)
title = ImageFont.truetype(str(FONT), 46)
subtitle = ImageFont.truetype(str(FONT), 20)
draw.text((72, 10), "EARTH", font=title, fill="#4a3d33")
draw.text((72, 1038), "ONE LIFE · FOUR CHOICES · A THOUSAND MEMORIES", font=subtitle, fill="#8a6848")
social_canvas.save(RELEASE / "earth-social-1920x1080.png", optimize=True)
cover = social.resize((1152, 648), Image.Resampling.NEAREST).crop((261, 74, 891, 574))
cover.save(RELEASE / "itch-cover-630x500.png", optimize=True)

banner = Image.new("RGB", (1920, 640), DARK)
main = Image.open(SHOTS / "main-1920.png").convert("RGB").crop((0, 0, 960, 640))
banner.paste(main, (0, 0))
draw = ImageDraw.Draw(banner)
draw.rectangle((0, 0, 1919, 639), outline=GOLD, width=4)
draw.rectangle((960, 0, 964, 640), fill=GOLD)
title = ImageFont.truetype(str(FONT), 66)
subtitle = ImageFont.truetype(str(FONT), 26)
small = ImageFont.truetype(str(FONT), 16)
draw.text((1020, 82), "EARTH", font=title, fill=TEXT)
draw.text((1020, 182), "ONE LIFE", font=title, fill=GOLD)
draw.line((1020, 290, 1800, 290), fill=GOLD, width=4)
draw.text((1020, 340), "FOUR CHOICES.", font=subtitle, fill=TEXT)
draw.text((1020, 400), "A THOUSAND WAYS", font=subtitle, fill=TEXT)
draw.text((1020, 460), "TO BE REMEMBERED.", font=subtitle, fill=TEXT)
draw.text((1020, 545), "A complete life in your browser.", font=small, fill=MUTED)
banner.save(RELEASE / "itch-banner.png", optimize=True)

sources = {
    "01-choices.png": "main-1280.png",
    "02-people.png": "people-1920.png",
    "03-family.png": "lineage-2-1920.png",
    "04-memorial.png": "memorial-1920.png",
    "05-lineage.png": "lineage-3-1920.png",
}
for target, source in sources.items():
    copyfile(SHOTS / source, RELEASE / "screenshots" / target)

frames = []
font_big = ImageFont.truetype(str(FONT), 48)
font_small = ImageFont.truetype(str(FONT), 20)
for source, heading, caption in [
    ("main-1920.png", "LIVE", "Every year starts with four choices."),
    ("people-1920.png", "CONNECT", "People remember your attention."),
    ("lineage-2-1920.png", "CONTINUE", "The next life inherits your story."),
    ("memorial-1920.png", "REMEMBER", "Your choices become a living memorial."),
    ("lineage-3-1920.png", "GROW OLD", "Life ends. Its story does not."),
]:
    frame = Image.open(SHOTS / source).convert("RGB")
    draw = ImageDraw.Draw(frame)
    draw.rectangle((0, 900, 1920, 1080), fill=PANEL)
    draw.text((72, 930), heading, font=font_big, fill=GOLD)
    draw.text((72, 1020), caption, font=font_small, fill=TEXT)
    frames.append(frame)
frames[0].save(RELEASE / "earth-life.gif", save_all=True, append_images=frames[1:], duration=1100, loop=0, optimize=True)
print(f"Banner: {RELEASE / 'itch-banner.png'}")
print(f"GIF: {len(frames)} frames")
print(f"Screenshots: {len(sources)}")
