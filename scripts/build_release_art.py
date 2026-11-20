from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RELEASE = ROOT / "release"
SHOTS = ROOT / "shots" / "release-web"
FONT = ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"
DARK = "#15131d"
PANEL = "#201c2a"
GOLD = "#e0b85c"
TEXT = "#f6edda"
MUTED = "#b9adbe"

RELEASE.mkdir(exist_ok=True)
(RELEASE / "screenshots").mkdir(exist_ok=True)

social = Image.open(RELEASE / "earth-social-1920x1080.png").convert("RGB")
scene = social.crop((442, 122, 1478, 900))
scene = scene.crop((0, 70, scene.width, 710))
banner = Image.new("RGB", (1920, 640), DARK)
banner.paste(scene, (0, 0))
draw = ImageDraw.Draw(banner)
draw.rectangle((0, 0, 1919, 639), outline=GOLD, width=4)
draw.rectangle((1036, 0, 1040, 640), fill=GOLD)
title = ImageFont.truetype(str(FONT), 76)
subtitle = ImageFont.truetype(str(FONT), 30)
small = ImageFont.truetype(str(FONT), 17)
draw.text((1100, 120), "EARTH", font=title, fill=TEXT)
draw.text((1100, 240), "ONE LIFE", font=title, fill=GOLD)
draw.line((1100, 365, 1760, 365), fill=GOLD, width=4)
draw.text((1100, 410), "FOUR CHOICES.", font=subtitle, fill=TEXT)
draw.text((1100, 465), "A THOUSAND WAYS", font=subtitle, fill=TEXT)
draw.text((1100, 520), "TO BE REMEMBERED.", font=subtitle, fill=TEXT)
banner.save(RELEASE / "itch-banner.png", optimize=True)

sources = {
    "01-choices.png": "en-event-1280.png",
    "02-people.png": "en-people-1280.png",
    "03-family.png": "en-family-memory-1280.png",
    "04-memorial.png": "en-memorial-1280.png",
    "05-lineage.png": "en-lineage-3-1280.png",
}
for target, source in sources.items():
    copyfile(SHOTS / source, RELEASE / "screenshots" / target)

ages = Image.open(ROOT / "shots" / "socket-full-production" / "ages.png").convert("RGB")
frames = []
font_big = ImageFont.truetype(str(FONT), 51)
font_mid = ImageFont.truetype(str(FONT), 30)
font_small = ImageFont.truetype(str(FONT), 22)
for index, label in [(0, "BEGIN"), (2, "LEARN"), (4, "CHOOSE"), (6, "REMEMBER"), (8, "GROW OLD")]:
    frame = Image.new("RGB", (1920, 1080), DARK)
    draw = ImageDraw.Draw(frame)
    draw.text((96, 72), "ONE LIFE", font=font_big, fill=GOLD)
    draw.text((96, 168), "Every year leaves a different story.", font=font_small, fill=MUTED)
    frame.paste(ages.crop((index * 240, 0, (index + 1) * 240, 348)), (120, 360))
    draw.text((645, 465), label, font=font_big, fill=TEXT)
    draw.text((645, 585), "Live. Choose. Remember.", font=font_mid, fill=GOLD)
    frames.append(frame)
for source, heading, caption in [
    ("04-memorial.png", "REMEMBER", "Your choices become a living memorial."),
    ("05-lineage.png", "CONTINUE", "The next life inherits more than money."),
]:
    frame = Image.new("RGB", (1920, 1080), DARK)
    draw = ImageDraw.Draw(frame)
    frame.paste(Image.open(SHOTS / sources[source]).convert("RGB"), (0, 0))
    draw.rectangle((0, 885, 1920, 1080), fill=PANEL)
    draw.text((72, 920), heading, font=font_big, fill=GOLD)
    draw.text((72, 1010), caption, font=font_small, fill=TEXT)
    frames.append(frame)
frames[0].save(RELEASE / "earth-life.gif", save_all=True, append_images=frames[1:], duration=850, loop=0, optimize=True)
print(f"Banner: {RELEASE / 'itch-banner.png'}")
print(f"GIF: {len(frames)} frames")
print(f"Screenshots: {len(sources)}")
