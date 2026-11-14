#!/usr/bin/env python3
"""Design-review previews: python3 tools/preview.py <output dir>

Writes walls.png, drills.png, units.png, forge.png, conveyors.png, air.png, hangar.png,
turrets2.png, walls2.png, naval.png, shipyard.png,
walkers.png, nest.png, mortar.png, power.png, works.png, flow.png (each scaled 4x, NEAREST, dark background)."""
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
    for fam, table, layer, col in (("shield", w2.AEGIS, "-glow", None),):
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
    for fam in ("shield",):
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


def paste_rot(dst, im, cx, cy, deg):
    r = im.rotate(deg, resample=Image.NEAREST, expand=True)
    dst.alpha_composite(r, (int(round(cx - r.width / 2)), int(round(cy - r.height / 2))))


def stretch(im, length):
    """A leg strip stretched to `length` px (like Lines.line), keeping its height."""
    return im.resize((max(1, int(round(length))), im.height), Image.NEAREST)


def assemble_walker(u, outline=3):
    import math
    import walkers
    C = u['C']
    cnt, length = u['legs'][:2]
    base_off = u['legs'][2]
    pad = int(length * 4 * 1.1) + 8
    W = C + 2 * pad
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    cx = cy = W / 2
    n = u['name']
    leg, legb, joint = (load(f"sprites/units/{n}{s}.png") for s in ("-leg", "-leg-base", "-joint"))
    foot = load(f"sprites/units/{n}-foot.png") if u['leg']['foot'] else None
    legs = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for i in range(cnt):
        phi = math.radians(360 / cnt * (i + 0.5))          # from "up", clockwise
        dx, dy = math.sin(phi), -math.cos(phi)
        root = (cx + dx * base_off * 4, cy + dy * base_off * 4)
        jnt = (root[0] + dx * length * 2, root[1] + dy * length * 2)
        ft = (root[0] + dx * length * 4, root[1] + dy * length * 4)
        ang = -math.degrees(math.atan2(dy, dx))
        for strip, a, b in ((leg, root, jnt), (legb, jnt, ft)):
            seg = stretch(strip, length * 2)
            paste_rot(legs, seg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ang)
        if foot:
            paste_rot(legs, foot, ft[0], ft[1], ang)
        legs.alpha_composite(joint, (int(jnt[0] - joint.width / 2), int(jnt[1] - joint.height / 2)))
    img.alpha_composite(outlined(legs, outline))
    top = Image.new("RGBA", img.size, (0, 0, 0, 0))
    top.alpha_composite(load(f"sprites/units/{n}.png"), (pad, pad))
    top.alpha_composite(tint(load(f"sprites/units/{n}-cell.png"), (255, 211, 127)), (pad, pad))
    m = u['mortar']
    mounts = [(f"{n}-mortar", m['x'], m['y']), (f"{n}-mortar", -m['x'], m['y'])]
    mounts += [(f"{n}-flak", x, y) for x, y in walkers.flak_mounts(u)]
    for name, x, y in mounts:
        w = load(f"sprites/units/{name}.png")
        top.alpha_composite(w, (int(cx + 4 * x - w.width / 2), int(cy - 4 * y - w.height / 2)))
    img.alpha_composite(outlined(top, outline))
    return img


def walkers_sheet(out):
    import walkers
    row = [up(assemble_walker(u)) for u in walkers.UNITS]
    raw = []
    for u in walkers.UNITS:
        for sfx in ("", "-cell", "-leg", "-leg-base", "-joint", "-foot", "-mortar", "-flak"):
            p = f"sprites/units/{u['name']}{sfx}.png"
            if os.path.exists(f"{ROOT}/{p}"):
                raw.append(up(on_bg(load(p))))
    sheet([row, raw]).save(out)


def nest(out):
    import walkers
    base = load("sprites/blocks/rapid-nest.png")
    full = base.copy()
    full.alpha_composite(load("sprites/blocks/rapid-nest-out.png"))
    full.alpha_composite(load("sprites/blocks/rapid-nest-top.png"))
    w = assemble_walker(walkers.BY_NAME["stalker"])
    w = w.crop(((w.width - 150) // 2, (w.height - 150) // 2, (w.width + 150) // 2, (w.height + 150) // 2))
    full.alpha_composite(w, (5, 5))
    sheet([[up(base), up(full)]]).save(out)


def mortars(out):
    import mortar as mo
    row = []
    for n in mo.MORTAR:
        name = f"sprites/blocks/rapid-mortar-{n}"
        img = load(f"{name}-base.png")
        img.alpha_composite(outlined(load(f"{name}.png")))
        hot = img.copy()
        heat = Image.new("RGBA", img.size, mo.GLOW + (0,))
        heat.putalpha(load(f"{name}-heat.png").getchannel("A"))
        hot.alpha_composite(heat)
        row += [up(img), up(hot)]
    sheet([row]).save(out)


def power_sheet(out):
    import power as pw
    from art import TIER
    row = []
    for n in pw.GEN:
        name = f"sprites/blocks/rapid-generator-{n}"
        img = load(f"{name}.png")
        lit = img.copy()
        lit.alpha_composite(tint(load(f"{name}-top.png"), TIER[n][0]))
        row += [up(img), up(lit)]
    row.append(up(load("sprites/blocks/rapid-solar.png")))
    bat = load("sprites/blocks/rapid-battery.png")
    charged = bat.copy()
    sq = Image.new("RGBA", (88, 88), (90, 215, 255, 255))
    charged.alpha_composite(sq, (4, 4))
    charged.alpha_composite(load("sprites/blocks/rapid-battery-top.png"))
    row += [up(bat), up(charged)]
    sheet([row]).save(out)


def bridge_link(name, tiles=4):
    """Two bridge ends `tiles` apart, linked left -> right, the way ItemBridge.draw stacks the layers."""
    W = 32 * (tiles + 1)
    img = Image.new("RGBA", (W, 32), BG)
    base, end, strip, arrow = (load(f"sprites/blocks/{name}{s}.png") for s in ("", "-end", "-bridge", "-arrow"))
    img.alpha_composite(base, (0, 0))
    img.alpha_composite(base, (W - 32, 0))
    span = Image.new("RGBA", (W, 32), (0, 0, 0, 0))
    s = strip.resize((W - 32, 26), Image.NEAREST)
    span.alpha_composite(s, (16, 3))
    span.alpha_composite(end.rotate(-90, expand=True), (0, 0))      # bottom edge faces the span (right)
    span.alpha_composite(end.rotate(90, expand=True), (W - 32, 0))
    for x in range(32, W - 32, 32):
        span.alpha_composite(arrow, (x, 0))
    img.alpha_composite(span)
    return img


def works_sheet(out):
    import works as wk
    rows = [[up(on_bg(load("sprites/items/rapid-steel.png")).resize((96 * K // 1, 96 * K // 1), Image.NEAREST))]]
    row = []
    for name, c in wk.CRAFTERS.items():
        img = load(f"sprites/blocks/{name}.png")
        lit = img.copy()
        lit.alpha_composite(tint(load(f"sprites/blocks/{name}-top.png"), wk.rgb(c['glow'])))
        row += [up(img), up(lit)]
    rows.append(row)
    unl = load("sprites/blocks/rapid-unloader.png")
    unl_lit = unl.copy()
    unl_lit.alpha_composite(tint(load("sprites/blocks/rapid-unloader-center.png"), wk.STEEL_BLUE))
    rows.append([up(load("sprites/blocks/rapid-junction.png")), up(bridge_link("rapid-bridge")),
                 up(bridge_link("rapid-phase-bridge")), up(unl), up(unl_lit), up(load("sprites/blocks/rapid-vault.png"))])
    sheet(rows).save(out)


def conduit_tile(n, k, bot, full, rot=0, flip=False):
    """One conduit tile drawn like ConduitBuild.draw: tinted bottom (approximated by a flat channel colour),
    water at 70 % over the tile (shape 1: columns 6..31 x rows 0..25), then the top."""
    import liquids
    t = Image.new("RGBA", (32, 32), BG)
    chan = liquids.channel(k)
    under = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    up_ = under.load()
    for y in range(32):
        for x in range(32):
            if chan(x, y):
                up_[x, y] = bot + (255,)
    t.alpha_composite(under)
    if full:
        w = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        box = (6, 0, 32, 26) if k == 1 else (0, 0, 32, 32)
        w.paste((89, 106, 184, 178), box)
        t.alpha_composite(w)
    t.alpha_composite(load(f"sprites/blocks/rapid-conduit-{n}-top-{k}.png"))
    if flip:
        t = t.transpose(Image.FLIP_TOP_BOTTOM)
    return t.rotate(rot)


def flow(out):
    import liquids
    import overdrive as od
    rows = []
    for n, c in liquids.CONDUITS.items():
        bot = tuple(int(c['bot'][i:i + 2], 16) for i in (0, 2, 4))
        row = []
        for full in (False, True):
            row += [up(conduit_tile(n, k, bot, full)) for k in range(5)]
            row.append(up(conduit_tile(n, 1, bot, full, flip=True)))
        if n == 2:
            cap = conduit_tile(n, 0, bot, True)
            cap.alpha_composite(load("sprites/blocks/rapid-conduit-2-cap.png"))
            row.append(up(cap))
        # a little network: straight, straight, curve (down -> right)
        net = Image.new("RGBA", (96, 64), BG)
        net.alpha_composite(conduit_tile(n, 0, bot, True), (0, 0))
        net.alpha_composite(conduit_tile(n, 0, bot, True), (32, 0))
        net.alpha_composite(conduit_tile(n, 1, bot, True, rot=-90, flip=True), (64, 0))
        net.alpha_composite(conduit_tile(n, 0, bot, True, rot=-90), (64, 32))
        row.append(up(net))
        rows.append(row)
    row = []
    for name in ("rapid-liquid-router", "rapid-liquid-tank"):
        bottom, top = load(f"sprites/blocks/{name}-bottom.png"), load(f"sprites/blocks/{name}.png")
        empty = bottom.copy()
        empty.alpha_composite(top)
        full = bottom.copy()
        pad = 16 if name.endswith("tank") else 0
        w = Image.new("RGBA", full.size, (0, 0, 0, 0))
        w.paste((89, 106, 184, 220), (pad, pad, full.width - pad, full.height - pad))
        full.alpha_composite(w)
        full.alpha_composite(top)
        row += [up(empty), up(full)]
    row += [up(bridge_link("rapid-liquid-bridge")), up(bridge_link("rapid-phase-conduit"))]
    rows.append(row)
    row = []
    for n in liquids.PUMPS:
        img = load(f"sprites/blocks/rapid-pump-{n}.png")
        wet = img.copy()
        liq = tint(load(f"sprites/blocks/rapid-pump-{n}-liquid.png"), (89, 106, 184))
        wet.alpha_composite(liq, ((img.width - liq.width) // 2, (img.height - liq.height) // 2))
        row += [up(img), up(wet)]
    for n, o in od.OD.items():
        img = load(f"sprites/blocks/rapid-overdrive-{n}.png")
        lit = img.copy()
        t = tint(load(f"sprites/blocks/rapid-overdrive-{n}-top.png"), tuple(int(o['base'][i:i + 2], 16) for i in (0, 2, 4)))
        t.putalpha(t.getchannel("A").point(lambda v: v // 2))
        lit.alpha_composite(t, ((img.width - t.width) // 2, (img.height - t.height) // 2))
        row += [up(img), up(lit)]
    rows.append(row)
    sheet(rows).save(out)


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
    walkers_sheet(f"{d}/walkers.png")
    nest(f"{d}/nest.png")
    mortars(f"{d}/mortar.png")
    power_sheet(f"{d}/power.png")
    works_sheet(f"{d}/works.png")
    flow(f"{d}/flow.png")


if __name__ == "__main__":
    main()
