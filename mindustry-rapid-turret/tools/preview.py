#!/usr/bin/env python3
"""Design-review previews: python3 tools/preview.py <output dir>

Writes walls.png, drills.png, units.png, forge.png (each scaled 4x, NEAREST, dark background)."""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art import outlined   # noqa: E402
from units import UNITS    # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (46, 48, 58, 255)
K = 4
GAP = 24


def load(path):
    return Image.open(f"{ROOT}/{path}").convert("RGBA")


def tint(im, col):
    r, g, b, a = im.split()
    r = r.point(lambda v: v * col[0] // 255)
    g = g.point(lambda v: v * col[1] // 255)
    b = b.point(lambda v: v * col[2] // 255)
    return Image.merge("RGBA", (r, g, b, a))


def up(im):
    return im.resize((im.width * K, im.height * K), Image.NEAREST)


def sheet(rows, pad=GAP):
    """rows: list of lists of RGBA images (already scaled). Lays them out left to right, top aligned."""
    w = max(sum(i.width for i in r) + pad * (len(r) + 1) for r in rows)
    h = sum(max(i.height for i in r) + pad for r in rows) + pad
    out = Image.new("RGBA", (w, h), BG)
    y = pad
    for r in rows:
        x = pad
        for im in r:
            out.alpha_composite(im, (x, y))
            x += im.width + pad
        y += max(i.height for i in r) + pad
    return out


def on_bg(im):
    c = Image.new("RGBA", im.size, BG)
    c.alpha_composite(im)
    return c


def walls(out):
    small = [load(f"sprites/blocks/rapid-wall-{n}.png") for n in range(1, 6)]
    large = [load(f"sprites/blocks/rapid-wall-{n}-large.png") for n in range(1, 6)]
    row = [up(i) for i in small + large]
    t3 = small[2]
    tiles = Image.new("RGBA", (96, 64))
    for x in range(3):
        for y in range(2):
            tiles.paste(t3, (x * 32, y * 32))
    sheet([row, [up(tiles)]]).save(out)


def drills(out):
    rows = []
    for n in range(1, 6):
        p = f"sprites/blocks/rapid-drill-{n}"
        base, rot, top, item = (load(f"{p}{s}.png") for s in ("", "-rotator", "-top", "-item"))
        comp = base.copy()
        comp.alpha_composite(rot)
        comp.alpha_composite(top)
        comp.alpha_composite(tint(item, (217, 157, 115)))
        rows.append([up(on_bg(i)) for i in (base, rot, top, item)] + [up(comp)])
    sheet(rows).save(out)


def assemble(u, pad=32, outline=3):
    """Stack of one mech the way the game draws it, on a canvas padded by `pad` px, with a simulated outline."""
    n, C = u['name'], u['C']
    sp = lambda s: load(f"sprites/units/{n}{s}.png")
    base, body, cell, leg, gun = sp("-base"), sp(""), sp("-cell"), sp("-leg"), sp("-gun")
    W = C + 2 * pad
    cv = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    cv.alpha_composite(base, (pad, pad))
    cv.alpha_composite(leg, (pad, pad))
    cv.alpha_composite(leg.transpose(Image.FLIP_LEFT_RIGHT), (pad, pad))
    gx, gy = int(round(u['mx'] * 4)), int(round(u['my'] * 4))
    gl = gun.transpose(Image.FLIP_LEFT_RIGHT)
    cv.alpha_composite(gun, (W // 2 + gx - gun.width // 2, W // 2 - gy - gun.height // 2))
    cv.alpha_composite(gl, (W // 2 - gx - gun.width // 2, W // 2 - gy - gun.height // 2))
    cv.alpha_composite(body, (pad, pad))
    cv.alpha_composite(tint(cell, (255, 211, 127)), (pad, pad))
    return outlined(cv, outline)


def units(out):
    rows = []
    for u in UNITS:
        n = u['name']
        raw = [load(f"sprites/units/{n}{s}.png") for s in ("", "-cell", "-base", "-leg", "-gun")]
        rows.append([up(assemble(u))] + [up(on_bg(i)) for i in raw])
    sheet(rows).save(out)


def forge(out):
    p = "sprites/blocks/rapid-forge"
    base, o, top = load(f"{p}.png"), load(f"{p}-out.png"), load(f"{p}-top.png")
    comp = base.copy()
    comp.alpha_composite(o)
    mech = assemble([u for u in UNITS if u['name'] == "barrage"][0])
    cv = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    cv.alpha_composite(mech, (200 - mech.width // 2, 200 - mech.height // 2))
    comp.alpha_composite(cv.crop((120, 120, 280, 280)))
    comp.alpha_composite(top)
    sheet([[up(base), up(comp)]]).save(out)


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(d, exist_ok=True)
    walls(f"{d}/walls.png")
    drills(f"{d}/drills.png")
    units(f"{d}/units.png")
    forge(f"{d}/forge.png")


if __name__ == "__main__":
    main()
