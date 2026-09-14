#!/usr/bin/env python3
"""Generate PWA icons (192/512 + apple-touch-icon) with PIL.

Design: rounded dark tile, gold house glyph, thin gold ring, gold top line.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
BG = (28, 26, 22, 255)
GOLD = (183, 139, 62, 255)
GOLD_SOFT = (228, 205, 156, 255)
GOLD_LINE = (214, 190, 130, 255)


def draw_tile(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = round(size * 0.22) if size >= 192 else round(size * 0.2)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=BG)

    # bottom gold accent line
    lw = max(2, round(size * 0.012))
    d.rounded_rectangle(
        (round(size * 0.12), size - round(size * 0.14), size - round(size * 0.12), size - round(size * 0.14) + lw),
        radius=lw, fill=GOLD_LINE)

    # house
    cx = size / 2
    unit = size / 24.0
    roof = [
        (cx - 7.2 * unit, 8.4 * unit),
        (cx + 7.2 * unit, 8.4 * unit),
        (cx, 3.4 * unit),
    ]
    body = [
        (cx - 6.6 * unit, 8.4 * unit),
        (cx + 6.6 * unit, 8.4 * unit),
        (cx + 6.6 * unit, 15.6 * unit),
        (cx - 6.6 * unit, 15.6 * unit),
    ]
    d.polygon(roof, fill=GOLD)
    d.polygon(body, fill=GOLD)
    # door
    door_w = 3.4 * unit
    door_h = 4.6 * unit
    d.rounded_rectangle(
        (cx - door_w / 2, 15.6 * unit - door_h, cx + door_w / 2, 15.6 * unit),
        radius=door_w / 2, fill=(20, 18, 14, 255))

    # soft top highlight
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dh = ImageDraw.Draw(hl)
    dh.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, outline=GOLD_SOFT, width=lw * 2)
    img = Image.alpha_composite(img, hl)
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
        icon = draw_tile(size)
        if size == 180:
            opaque = Image.new("RGB", (size, size), BG[:3])
            opaque.paste(icon, (0, 0), icon)
            opaque.save(OUT / name)
        else:
            icon.save(OUT / name)
        print(f"  wrote icons/{name}")


if __name__ == "__main__":
    main()