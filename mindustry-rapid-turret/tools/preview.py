#!/usr/bin/env python3
"""Design-review previews: python3 tools/preview.py <output dir>

Writes walls.png, drills.png, units.png, forge.png, conveyors.png, air.png, hangar.png,
turrets2.png, walls2.png, naval.png, shipyard.png (each scaled 4x, NEAREST, dark background)."""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art import outlined   # noqa: E402
from units import UNITS    # noqa: E402
import air                 # noqa: E402

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


def conveyors(out):
    rows = []
    for n in range(1, 6):
        p = f"sprites/blocks/rapid-conveyor-{n}"
        ld = lambda sh, f: load(f"{p}-{sh}-{f}.png")
        row = [up(on_bg(ld(sh, 0))) for sh in range(5)]
        row += [up(on_bg(ld(0, f))) for f in range(4)]
        # demo track: straight tile turned 90 degrees clockwise (output down) -> curve (input top, output right) -> two straights
        track = Image.new("RGBA", (96, 64), BG)
        track.alpha_composite(ld(0, 0).rotate(-90), (0, 0))
        track.alpha_composite(ld(1, 0), (0, 32))
        track.alpha_composite(ld(0, 0), (32, 32))
        track.alpha_composite(ld(0, 0), (64, 32))
        rows.append(row + [up(track)])
    sheet(rows).save(out)


def assemble_air(u, pad=32, outline=3):
    """Body + tinted cell + turrets (right and mirrored left) with a simulated outline."""
    n, C = u['name'], u['C']
    body, cell = load(f"sprites/units/{n}.png"), load(f"sprites/units/{n}-cell.png")
    W = C + 2 * pad
    cv = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    cv.alpha_composite(body, (pad, pad))
    cv.alpha_composite(tint(cell, (255, 211, 127)), (pad, pad))
    if u['turret']:
        t = load(f"sprites/units/{n}-turret.png")
        tl = t.transpose(Image.FLIP_LEFT_RIGHT)
        for mx, my in air.mounts(u):
            for im, sx in ((t, 1), (tl, -1)):
                cv.alpha_composite(im, (W // 2 + sx * mx - im.width // 2, W // 2 - my - im.height // 2))
    return outlined(cv, outline)


def airs(out):
    rows = []
    for u in air.UNITS:
        n = u['name']
        raw = [load(f"sprites/units/{n}{s}.png") for s in ("", "-cell")]
        if u['turret']:
            raw.append(load(f"sprites/units/{n}-turret.png"))
        rows.append([up(assemble_air(u))] + [up(on_bg(i)) for i in raw])
    sheet(rows).save(out)


def hangar(out):
    p = "sprites/blocks/rapid-hangar"
    base, o, top = load(f"{p}.png"), load(f"{p}-out.png"), load(f"{p}-top.png")
    comp = base.copy()
    comp.alpha_composite(o)
    fal = assemble_air([u for u in air.UNITS if u['name'] == "falcon"][0])
    cv = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    cv.alpha_composite(fal, (200 - fal.width // 2, 200 - fal.height // 2))
    comp.alpha_composite(cv.crop((120, 120, 280, 280)))
    comp.alpha_composite(top)
    sheet([[up(base), up(comp)]]).save(out)


def turrets2(out):
    """Pulse and Buckshot: gun outlined on its base, then the same with the heat layer lit in the line glow colour."""
    import turrets2 as t2
    rows = []
    for line, table, glow in (("pulse", t2.PULSE, t2.P_GLOW), ("buckshot", t2.BUCK, t2.B_GLOW)):
        row = []
        for n in table:
            name = f"sprites/blocks/rapid-{line}-{n}"
            img = load(f"{name}-base.png")
            img.alpha_composite(outlined(load(f"{name}.png")))
            hot = img.copy()
            heat = Image.new("RGBA", img.size, glow + (0,))
            heat.putalpha(load(f"{name}-heat.png").getchannel("A"))
            hot.alpha_composite(heat)
            row += [up(img), up(hot)]
        rows.append(row)
    sheet(rows).save(out)


def walls2(out):
    """Aegis and Regen walls: small, large, each with its overlay lit; plus a 3x2 run of tier-2 small walls."""
    import walls2 as w2
    rows = []
    for fam, table, layer, col in (("shield", w2.AEGIS, "-glow", None), ("regen", w2.REGEN, "-top", w2.HEAL)):
        row = []
        for n in table:
            for sfx in ("", "-large"):
                name = f"sprites/blocks/rapid-{fam}-wall-{n}{sfx}"
                img = load(f"{name}.png")
                lit = img.copy()
                ov = load(f"{name}{layer}.png")
                c = col or w2.TIER[n][0]
                glow = Image.new("RGBA", img.size, c + (0,))
                glow.putalpha(ov.getchannel("A").point(lambda v: v // 2))
                lit.alpha_composite(glow)
                row += [up(img), up(lit)]
        rows.append(row)
    for fam in ("shield", "regen"):
        run = Image.new("RGBA", (96, 64), BG)
        for x in range(3):
            for y in range(2):
                run.alpha_composite(load(f"sprites/blocks/rapid-{fam}-wall-2.png"), (x * 32, y * 32))
        rows.append([up(run)])
    sheet(rows).save(out)


def assemble_ship(u, outline=3):
    """Body + tinted cell + every weapon sprite at its mount (barrels up), with a simulated outline."""
    import naval
    W, H = u['W'], u['H']
    pad = 16
    img = Image.new("RGBA", (W + 2 * pad, H + 2 * pad), (0, 0, 0, 0))
    img.alpha_composite(load(f"sprites/units/{u['name']}.png"), (pad, pad))
    img.alpha_composite(tint(load(f"sprites/units/{u['name']}-cell.png"), (255, 211, 127)), (pad, pad))
    mounts = [(f"{u['name']}-turret", 0, y) for y in u['guns']]
    mounts += [(f"{u['name']}-flak", x, y) for x, y in naval.flak_mounts(u)]
    for name, x, y in mounts:
        w = load(f"sprites/units/{name}.png")
        mx, my = naval.mount_px(u, x, y)
        img.alpha_composite(w, (int(pad + mx - w.width / 2), int(pad + my - w.height / 2)))
    return outlined(img, outline)


def ships(out):
    import naval
    row = [up(assemble_ship(u)) for u in naval.UNITS]
    raw = []
    for u in naval.UNITS:
        for sfx in ("", "-cell", "-turret", "-flak"):
            p = f"sprites/units/{u['name']}{sfx}.png"
            if os.path.exists(f"{ROOT}/{p}"):
                raw.append(up(on_bg(load(p))))
    sheet([row, raw]).save(out)


def shipyard(out):
    import naval
    base = load("sprites/blocks/rapid-shipyard.png")
    full = base.copy()
    full.alpha_composite(load("sprites/blocks/rapid-shipyard-out.png"))
    ship = assemble_ship(naval.BY_NAME["corvette"])
    full.alpha_composite(ship, (80 - ship.width // 2, 80 - ship.height // 2))
    full.alpha_composite(load("sprites/blocks/rapid-shipyard-top.png"))
    sheet([[up(base), up(full)]]).save(out)


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(d, exist_ok=True)
    walls(f"{d}/walls.png")
    drills(f"{d}/drills.png")
    units(f"{d}/units.png")
    forge(f"{d}/forge.png")
    conveyors(f"{d}/conveyors.png")
    airs(f"{d}/air.png")
    hangar(f"{d}/hangar.png")
    turrets2(f"{d}/turrets2.png")
    walls2(f"{d}/walls2.png")
    ships(f"{d}/naval.png")
    shipyard(f"{d}/shipyard.png")


if __name__ == "__main__":
    main()
