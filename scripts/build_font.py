from pathlib import Path

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "fonts" / "PressStart2P-Regular.ttf"
OUTPUT = ROOT / "public" / "fonts" / "PressStart2P-Regular.woff2"


def outlines(font):
    glyphs = font.getGlyphSet()
    result = {}
    for name in font.getGlyphOrder():
        pen = RecordingPen()
        glyphs[name].draw(pen)
        result[name] = tuple(pen.value)
    return result


def main():
    font = TTFont(SOURCE)
    original = outlines(font)
    font.flavor = "woff2"
    font.save(OUTPUT)
    converted = TTFont(OUTPUT)
    assert converted.getGlyphOrder() == font.getGlyphOrder()
    assert outlines(converted) == original
    print(f"WOFF2: {SOURCE.stat().st_size} -> {OUTPUT.stat().st_size} байт; начертания совпадают")


if __name__ == "__main__":
    main()
