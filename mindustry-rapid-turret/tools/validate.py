#!/usr/bin/env python3
"""Checks the generated mod. Exit code 1 on any problem. Needs Pillow and hjson."""
import glob
import os
import re
import shutil
import subprocess
import sys

import hjson
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JAR = "/tmp/mt/server.jar"
errors = []


def err(msg):
    errors.append(msg)
    print("ERROR:", msg)


def parse(path):
    try:
        return hjson.loads("{\n" + open(path, encoding="utf-8").read() + "\n}")
    except Exception as e:   # noqa: BLE001
        err(f"{path}: hjson does not parse: {e}")
        return None


REQ = re.compile(r"^[a-z-]+/\d+$")


def check_reqs(obj, where):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "requirements":
                if not isinstance(v, list):
                    err(f"{where}: requirements is not a list")
                    continue
                for e in v:
                    if not isinstance(e, str) or not REQ.match(e):
                        err(f"{where}: bad requirement entry {e!r}")
            elif k == "research" and isinstance(v, str):
                if not re.match(r"^[a-z0-9-]+$", v):
                    err(f"{where}: bad research parent {v!r}")
            check_reqs(v, where)
    elif isinstance(obj, list):
        for e in obj:
            check_reqs(e, where)


def sprite(path, size, border=None, opaque=False):
    p = f"{ROOT}/{path}"
    if not os.path.exists(p):
        err(f"missing sprite {path}")
        return
    im = Image.open(p).convert("RGBA")
    if im.size != size:
        err(f"{path}: size {im.size}, expected {size}")
        return
    a = im.getchannel("A")
    W, H = im.size
    if opaque and a.getextrema()[0] != 255:
        err(f"{path}: has transparent pixels")
    if border:
        px = a.load()
        for y in range(H):
            for x in range(W):
                if (x < border or y < border or x >= W - border or y >= H - border) and px[x, y]:
                    err(f"{path}: non-transparent pixel in the {border}px border at {(x, y)}")
                    return


def check_conveyor(n):
    def ld(sh, f):
        p = f"{ROOT}/sprites/blocks/rapid-conveyor-{n}-{sh}-{f}.png"
        return Image.open(p).convert("RGBA") if os.path.exists(p) else None
    for sh in range(5):
        for f in range(4):
            im = ld(sh, f)
            if im is None or im.size != (32, 32):
                return
            px = im.load()
            clear = {(x, y) for x in range(32) for y in range(32) if px[x, y][3] == 0}
            if sh != 1 and clear:
                err(f"rapid-conveyor-{n}-{sh}-{f}: has transparent pixels")
            if sh == 1:
                bad = [p for p in clear if p[1] - p[0] < 23]
                if bad or not clear:
                    err(f"rapid-conveyor-{n}-1-{f}: transparency must be only the bottom-left cut corner ({bad[:3]})")
    for f in range(4):
        a, b = ld(0, f), ld(0, (f + 1) % 4)
        if a is None or b is None or a.size != (32, 32) or b.size != (32, 32):
            return
        for y in range(4, 28):
            for x in range(32):
                if a.getpixel(((x - 4) % 32, y)) != b.getpixel((x, y)):
                    err(f"rapid-conveyor-{n}-0: frame {f} shifted 4px does not give frame {(f + 1) % 4} (pixel {(x, y)})")
                    return


def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import drills
    import units
    import air

    files = sorted(glob.glob(f"{ROOT}/content/blocks/*.hjson") + glob.glob(f"{ROOT}/content/units/*.hjson") +
                   glob.glob(f"{ROOT}/content/items/*.hjson"))
    data = {}
    for f in files:
        d = parse(f)
        if d is not None:
            data[f] = d
            check_reqs(d, os.path.relpath(f, ROOT))

    # sprites
    for t in range(1, 7):
        S = {1: 2, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6}[t] * 32
        for s in ("", "-heat", "-base"):
            sprite(f"sprites/blocks/rapid-{t}{s}.png", (S, S))
    for n in range(1, 6):
        sprite(f"sprites/blocks/rapid-wall-{n}.png", (32, 32), opaque=True)
        sprite(f"sprites/blocks/rapid-wall-{n}-large.png", (64, 64), opaque=True)
        S = drills.DRILLS[n]['size'] * 32
        sprite(f"sprites/blocks/rapid-drill-{n}.png", (S, S), opaque=True)
        for s in ("-rotator", "-top", "-item"):    # cropped layers: square, even, no bigger than the block
            p = f"{ROOT}/sprites/blocks/rapid-drill-{n}{s}.png"
            if not os.path.exists(p):
                err(f"missing sprite rapid-drill-{n}{s}")
                continue
            w, h = Image.open(p).size
            if w != h or w % 2 or w > S:
                err(f"rapid-drill-{n}{s}: size {(w, h)} must be square, even and at most {S}")
    sprite("sprites/blocks/rapid-forge.png", (160, 160), opaque=True)
    for s in ("-top", "-out", "-in"):
        sprite(f"sprites/blocks/rapid-forge{s}.png", (160, 160))
    for u in units.UNITS:
        n, C = u['name'], u['C']
        for s in ("", "-cell", "-base", "-leg"):
            sprite(f"sprites/units/{n}{s}.png", (C, C), border=4)
        W, H = u['gun'][:2]
        sprite(f"sprites/units/{n}-gun.png", (W, H), border=4)

    # conveyors
    for n in range(1, 6):
        for sh in range(5):
            for f in range(4):
                sprite(f"sprites/blocks/rapid-conveyor-{n}-{sh}-{f}.png", (32, 32), opaque=sh != 1)
        check_conveyor(n)
    # hangar
    sprite("sprites/blocks/rapid-hangar.png", (160, 160), opaque=True)
    for s in ("-top", "-out", "-in"):
        sprite(f"sprites/blocks/rapid-hangar{s}.png", (160, 160))
    # air units
    for u in air.UNITS:
        n, C = u['name'], u['C']
        for s in ("", "-cell"):
            sprite(f"sprites/units/{n}{s}.png", (C, C), border=4)
        if u['turret']:
            sprite(f"sprites/units/{n}-turret.png", u['turret'][:2], border=4)

    # Part 3: Pulse / Buckshot turrets, Aegis / Regen walls
    import turrets2
    import walls2
    for line, table in (("pulse", turrets2.PULSE), ("buckshot", turrets2.BUCK)):
        for n, p in table.items():
            S = p['size'] * 32
            sprite(f"sprites/blocks/rapid-{line}-{n}.png", (S, S), border=5)
            sprite(f"sprites/blocks/rapid-{line}-{n}-heat.png", (S, S), border=5)
            sprite(f"sprites/blocks/rapid-{line}-{n}-base.png", (S, S))
    for fam, table, layer in (("shield", walls2.AEGIS, "-glow"),):
        for n in table:
            for sfx, S in (("", 32), ("-large", 64)):
                name = f"rapid-{fam}-wall-{n}{sfx}"
                sprite(f"sprites/blocks/{name}.png", (S, S), opaque=True)
                sprite(f"sprites/blocks/{name}{layer}.png", (S, S))
                p = f"{ROOT}/sprites/blocks/{name}{layer}.png"
                if os.path.exists(p) and Image.open(p).convert("RGBA").getchannel("A").getextrema()[0] == 255:
                    err(f"{name}{layer}: overlay layer is fully opaque")
            small = data.get(f"{ROOT}/content/blocks/rapid-{fam}-wall-{n}.hjson")
            large = data.get(f"{ROOT}/content/blocks/rapid-{fam}-wall-{n}-large.hjson")
            if small and large:
                if large["health"] != 4 * small["health"]:
                    err(f"rapid-{fam}-wall-{n}-large: health is not 4x the small wall")
                sc = {e.split("/")[0]: int(e.split("/")[1]) for e in small["requirements"]}
                lc = {e.split("/")[0]: int(e.split("/")[1]) for e in large["requirements"]}
                if lc != {k: 4 * v for k, v in sc.items()}:
                    err(f"rapid-{fam}-wall-{n}-large: cost is not 4x the small wall")

    # Part 4: warships and the shipyard
    import naval
    check_naval(naval, data)
    # Part 5: walkers, nest, mortars, power
    check_part5(data)
    # Part 6: Rapid Steel, crafters, logistics
    check_part6(data)
    # Part 7: liquids and overdrive
    check_part7(data)

    # bundles
    bundles = {}
    for b in ("bundle.properties", "bundle_ru.properties"):
        keys = {}
        for line in open(f"{ROOT}/bundles/{b}", encoding="utf-8"):
            if " = " in line:
                k, v = line.rstrip("\n").split(" = ", 1)
                keys[k] = v
        bundles[b] = keys
    for f in data:
        name = os.path.splitext(os.path.basename(f))[0]
        kind = "unit" if "/content/units/" in f else "item" if "/content/items/" in f else "block"
        for b, keys in bundles.items():
            for suffix in ("name", "description"):
                k = f"{kind}.rapid-turret-{name}.{suffix}"
                if not keys.get(k):
                    err(f"{b}: missing {k}")

    # optional: field names against the game classes (static javap only, the jar is never executed)
    if os.path.exists(JAR) and shutil.which("javap"):
        check_fields(data)
    else:
        print("note: /tmp/mt/server.jar or javap missing, skipping field check")

    print(f"{len(data)} hjson files checked, {len(errors)} problems")
    return 1 if errors else 0


def symmetric(im):
    return im.tobytes() == im.transpose(Image.FLIP_LEFT_RIGHT).tobytes()


def check_naval(naval, data):
    for u in naval.UNITS:
        n, W, H = u['name'], u['W'], u['H']
        files = [(f"sprites/units/{n}.png", (W, H)), (f"sprites/units/{n}-cell.png", (W, H)),
                 (f"sprites/units/{n}-turret.png", (u['tur']['W'], u['tur']['H']))]
        if u['flak']:
            files.append((f"sprites/units/{n}-flak.png", (20, 30) if u['T'] >= 4 else (14, 22)))
        for path, size in files:
            sprite(path, size, border=4)
            p = f"{ROOT}/{path}"
            if os.path.exists(p) and not symmetric(Image.open(p).convert("RGBA")):
                err(f"{path}: not mirror symmetric")
        d = data.get(f"{ROOT}/content/units/{n}.hjson")
        if not d:
            err(f"content/units/{n}.hjson missing")
            continue
        if d.get("type") != "naval" or d.get("faceTarget") is not False:
            err(f"{n}: needs type: naval and faceTarget: false")
        for bad in ("naval", "flying", "canDrown", "engineOffset", "engineSize"):
            if bad in d:
                err(f"{n}: must not set {bad}")
        p = f"{ROOT}/sprites/units/{n}.png"
        if not os.path.exists(p):
            continue
        body = Image.open(p).convert("RGBA")
        cellim = Image.open(f"{ROOT}/sprites/units/{n}-cell.png").convert("RGBA")
        hw, ys, yt, yb, sw = u['hull'][:5]
        row = lambda y: sum(1 for x in range(W) if body.getpixel((x, y))[3])   # noqa: E731
        if not 2 <= row(4) <= 4 or not 2 * sw - 2 <= row(yb) <= 2 * sw or row(ys) != 2 * hw:
            err(f"{n}: hull outline rows wrong (bow {row(4)}, stern {row(yb)}, beam {row(ys)})")
        dark = naval.colours(u)[4]
        for x in range(W):
            for y in range(H):
                if cellim.getpixel((x, y))[3] and body.getpixel((x, y))[:3] != dark:
                    err(f"{n}-cell: pixel {(x, y)} is not over the dark bridge socket")
                    break
            else:
                continue
            break
        for w in d.get("weapons", []):
            if w.get("rotate") is not True:
                err(f"{n}: weapon {w.get('name')} without rotate: true")
            if w.get("x") == 0 and w.get("mirror") is not False:
                err(f"{n}: centreline weapon {w.get('name')} must have mirror: false")
            b = w.get("bullet", {})
            if b.get("type") == "FlakBulletType":
                if w.get("controllable") is not False or w.get("autoTarget") is not True or "collidesGround" in b:
                    err(f"{n}: flak weapon needs controllable: false, autoTarget: true and no collidesGround")
            mx, my = naval.mount_px(u, w.get("x", 0), w.get("y", 0))
            if not body.getpixel((int(mx), int(my)))[3]:
                err(f"{n}: weapon {w.get('name')} mount {(mx, my)} is not on the hull")
            sp = f"{ROOT}/sprites/units/{w.get('name')}.png"
            if os.path.exists(sp):
                hgt = Image.open(sp).height
                if abs(w.get("shootY", 0) - (hgt / 2 - 4) / 4) > 1e-6:
                    err(f"{n}: {w.get('name')} shootY {w.get('shootY')} != (height/2-4)/4")
        if u['spread']:
            bars = u['tur']['bars']
            centres = sorted({(b[0] + b[1]) / 2 for b in bars} | {u['tur']['W'] - 1 - (b[0] + b[1]) / 2 for b in bars})
            gaps = {round(centres[i + 1] - centres[i], 3) for i in range(len(centres) - 1)}
            if gaps != {u['spread'] * 4}:
                err(f"{n}: barrel spacing {gaps} px does not match spread {u['spread']}")
    y = data.get(f"{ROOT}/content/blocks/rapid-shipyard.hjson")
    if not y:
        err("rapid-shipyard.hjson missing")
        return
    if y.get("floating") is not True or "requiresWater" in y or y.get("research") != "naval-factory":
        err("rapid-shipyard: needs floating: true, no requiresWater, research naval-factory")
    if [p.get("unit") for p in y.get("plans", [])] != [u['name'] for u in naval.UNITS]:
        err("rapid-shipyard: plans do not list the five warships in order")
    sprite("sprites/blocks/rapid-shipyard.png", (160, 160), opaque=True)
    for sfx in ("-top", "-out", "-in"):
        sprite(f"sprites/blocks/rapid-shipyard{sfx}.png", (160, 160))


def vsymmetric(im):
    return im.tobytes() == im.transpose(Image.FLIP_TOP_BOTTOM).tobytes()


def artillery_ok(b, where, rng=None, unit_range=None):
    if b.get("trailEffect") != "none":
        err(f"{where}: artillery shells need trailEffect: none")
    if not b.get("splashDamage", 0) > 0:
        err(f"{where}: artillery shell without splashDamage")
    for bad in ("homingPower", "fragBullets", "makeFire", "collides", "collidesAir"):
        if bad in b:
            err(f"{where}: artillery shell must not set {bad}")
    reach = b.get("speed", 0) * b.get("lifetime", 0)
    if rng is not None and not rng <= reach < rng + 4:
        err(f"{where}: speed*lifetime {reach} must be in [range, range+4) = [{rng}, {rng + 4})")
    if unit_range is not None and abs(reach - unit_range) > 1:
        err(f"{where}: speed*lifetime {reach} != {unit_range}")


def check_part5(data):
    import walkers
    import mortar
    import power
    for u in walkers.UNITS:
        n, C = u['name'], u['C']
        d = data.get(f"{ROOT}/content/units/{n}.hjson")
        if not d:
            err(f"content/units/{n}.hjson missing")
            continue
        if d.get("type") != "legs" or d.get("hovering") is not True or d.get("targetAir") is not False:
            err(f"{n}: needs type: legs, hovering: true, targetAir: false")
        if d.get("legCount", 0) < 4 or d.get("legCount") % 2:
            err(f"{n}: legCount must be even and >= 4")
        for bad in ("allowLegStep", "flying", "naval", "canDrown", "mechFrontSway", "engineOffset"):
            if bad in d:
                err(f"{n}: must not set {bad}")
        for w in d.get("weapons", []):
            if w.get("reload", 0) < 7:
                err(f"{n}: weapon {w.get('name')} reload < 7")
            b = w.get("bullet", {})
            if b.get("type") == "ArtilleryBulletType":
                if "rotate" in w:
                    err(f"{n}: the mortar must not rotate")
                m = u['mortar']
                artillery_ok(b, f"{n} mortar", unit_range=round(m['speed'] * m['life'], 1))
            else:
                if w.get("rotate") is not True or w.get("controllable") is not False or w.get("autoTarget") is not True:
                    err(f"{n}: flak needs rotate, controllable: false, autoTarget: true")
            sp = f"{ROOT}/sprites/units/{w.get('name')}.png"
            if os.path.exists(sp) and abs(w.get("shootY", 0) - (Image.open(sp).height / 2 - 4) / 4) > 1e-6:
                err(f"{n}: {w.get('name')} shootY != (height/2-4)/4")
        for sfx, size, mirror in (("", (C, C), "lr"), ("-cell", (C, C), "lr"), ("-leg", u['leg']['L'], "tb"),
                                  ("-leg-base", u['leg']['L'], "tb"), ("-joint", (u['leg']['joint'],) * 2, None),
                                  ("-mortar", u['mortar']['canvas'], "lr")):
            path = f"sprites/units/{n}{sfx}.png"
            border = 4 if sfx not in ("-leg", "-leg-base") else None
            sprite(path, size, border=border)
            p = f"{ROOT}/{path}"
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert("RGBA")
            if mirror == "lr" and not symmetric(im):
                err(f"{path}: not left/right symmetric")
            if mirror == "tb":
                if not vsymmetric(im):
                    err(f"{path}: not top/bottom symmetric")
                a = im.getchannel("A").load()
                Lw, Lh = im.size
                if any(a[x, y] for y in list(range(4)) + list(range(Lh - 4, Lh)) for x in range(Lw)):
                    err(f"{path}: the 4 top/bottom rows must be empty")
                if not all(a[0, y] for y in range(4, 4 + u['leg']['t'])):
                    err(f"{path}: column 0 must be opaque in the limb rows")
        if u['leg']['foot']:
            sprite(f"sprites/units/{n}-foot.png", (u['leg']['foot'],) * 2, border=4)
        if u['flak']:
            sprite(f"sprites/units/{n}-flak.png", (20, 30) if u['T'] >= 4 else (14, 22), border=4)
            body = Image.open(f"{ROOT}/sprites/units/{n}.png").convert("RGBA")
            for x, y in walkers.flak_mounts(u):
                if not body.getpixel((int(C / 2 + 4 * x), int(C / 2 - 4 * y)))[3]:
                    err(f"{n}: flak mount {(x, y)} is not on the body")
    y = data.get(f"{ROOT}/content/blocks/rapid-nest.hjson")
    if not y or y.get("research") != "ground-factory" or "floating" in y or \
            [p.get("unit") for p in y.get("plans", [])] != [u['name'] for u in walkers.UNITS]:
        err("rapid-nest: needs research ground-factory, no floating, the five walkers in order")
    sprite("sprites/blocks/rapid-nest.png", (160, 160), opaque=True)
    for sfx in ("-top", "-out", "-in"):
        sprite(f"sprites/blocks/rapid-nest{sfx}.png", (160, 160))
    for n, p in mortar.MORTAR.items():
        d = data.get(f"{ROOT}/content/blocks/rapid-mortar-{n}.hjson")
        S = p['size'] * 32
        for sfx in ("", "-heat"):
            sprite(f"sprites/blocks/rapid-mortar-{n}{sfx}.png", (S, S), border=5)
        sprite(f"sprites/blocks/rapid-mortar-{n}-base.png", (S, S))
        if not d:
            continue
        if d.get("targetAir") is not False:
            err(f"rapid-mortar-{n}: targetAir must be false")
        if d.get("minRange", 0) >= d["range"] / 4:
            err(f"rapid-mortar-{n}: minRange too large")
        if 60 / d["reload"] * 1.2 > 60:
            err(f"rapid-mortar-{n}: more than 60 shells/s")
        if isinstance(d.get("shoot"), dict) and abs(d["shoot"]["spread"] * 4 - mortar.ART[n][0]) > 1e-6:
            err(f"rapid-mortar-{n}: shoot.spread*4 != barrel pitch")
        for item, b in d.get("ammoTypes", {}).items():
            artillery_ok(b, f"rapid-mortar-{n} {item}", rng=d["range"])
    for n, g in power.GEN.items():
        name = f"rapid-generator-{n}"
        d = data.get(f"{ROOT}/content/blocks/{name}.hjson")
        S = g['size'] * 32
        sprite(f"sprites/blocks/{name}.png", (S, S), opaque=True)
        sprite(f"sprites/blocks/{name}-top.png", (S, S))
        tp = f"{ROOT}/sprites/blocks/{name}-top.png"
        if os.path.exists(tp) and Image.open(tp).convert("RGBA").getchannel("A").getextrema()[0] == 255:
            err(f"{name}-top: must not be opaque")
        if not d:
            continue
        cons = d.get("consumes", {})
        if not d.get("powerProduction", 0) > 0 or "power" in cons:
            err(f"{name}: needs powerProduction and no consumes.power")
        if sum(1 for k in cons if k.startswith("item")) != 1 or len(d.get("drawer", [])) != 2:
            err(f"{name}: needs exactly one item consumer and a 2-entry drawer")
    d = data.get(f"{ROOT}/content/blocks/rapid-battery.hjson")
    if not d or not d.get("consumes", {}).get("powerBuffered", 0) > 0:
        err("rapid-battery: needs consumes.powerBuffered")
    sprite("sprites/blocks/rapid-battery.png", (96, 96), opaque=True)
    sprite("sprites/blocks/rapid-battery-top.png", (96, 96))
    sprite("sprites/blocks/rapid-solar.png", (96, 96), opaque=True)
    tp = f"{ROOT}/sprites/blocks/rapid-battery-top.png"
    if os.path.exists(tp):
        a = Image.open(tp).convert("RGBA").getchannel("A").load()
        for yy in range(96):
            for xx in range(96):
                inside = 22 <= yy <= 73 and any(20 + 20 * k <= xx <= 35 + 20 * k for k in range(3))
                if not inside and a[xx, yy] != 255:
                    err(f"rapid-battery-top: transparent pixel outside the windows at {(xx, yy)}")
                    break
            else:
                continue
            break


def item_names():
    """Vanilla item names (camelCase static fields of Items -> dash-case) plus the mod's own items."""
    names = set()
    if os.path.exists(JAR) and shutil.which("javap"):
        for n in static_names("mindustry.content.Items"):
            names.add(re.sub(r"([A-Z])", lambda m: "-" + m.group(1).lower(), n))
    names |= {os.path.splitext(os.path.basename(f))[0] for f in glob.glob(f"{ROOT}/content/items/*.hjson")}
    return names


def stacks(d):
    """Every item name used in requirements, outputItem, consumes, ammo keys and factory plans."""
    out = []
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("requirements", "items") and isinstance(v, list):
                    out.extend(e.split("/")[0] for e in v if isinstance(e, str))
                elif k == "outputItem" and isinstance(v, str):
                    out.append(v.split("/")[0])
                elif k == "ammoTypes" and isinstance(v, dict):
                    out.extend(v)
                walk(v)
        elif isinstance(o, list):
            for e in o:
                walk(e)
    walk(d)
    return out


def check_part6(data):
    import works
    import logistics
    import gen
    names = item_names()
    if len(names) > 1:
        for f, d in data.items():
            for i in stacks(d):
                if i not in names:
                    err(f"{os.path.relpath(f, ROOT)}: unknown item {i!r}")
    # item
    it = data.get(f"{ROOT}/content/items/rapid-steel.hjson")
    if not it or not re.match(r"^[0-9a-f]{6}$", str(it.get("color", ""))) or "type" in it or "research" not in it:
        err("rapid-steel item: needs a 6-digit color, research and no type")
    sprite("sprites/items/rapid-steel.png", (32, 32), border=1)
    p = f"{ROOT}/sprites/items/rapid-steel.png"
    if os.path.exists(p) and not symmetric(Image.open(p).convert("RGBA")):
        err("rapid-steel item sprite is not left/right symmetric")
    for sub in ("blocks", "units"):
        if os.path.exists(f"{ROOT}/sprites/{sub}/rapid-steel.png"):
            err(f"sprites/{sub}/rapid-steel.png clashes with the item region")
    # crafters
    for name, c in works.CRAFTERS.items():
        d = data.get(f"{ROOT}/content/blocks/{name}.hjson")
        S = c['size'] * 32
        sprite(f"sprites/blocks/{name}.png", (S, S), opaque=True)
        sprite(f"sprites/blocks/{name}-top.png", (S, S))
        tp = f"{ROOT}/sprites/blocks/{name}-top.png"
        if os.path.exists(tp):
            top = Image.open(tp).convert("RGBA")
            if top.getchannel("A").getextrema()[0] == 255:
                err(f"{name}-top: must not be opaque")
            ins = 2 if S == 64 else 4
            tpx = top.load()
            for (x, y) in ((x, y) for y in range(S) for x in range(S)):
                px = tpx[x, y]
                if px[3] and (px[:3] != (255, 255, 255) or min(x, y, S - 1 - x, S - 1 - y) < ins):
                    err(f"{name}-top: pixel {(x, y)} must be pure white and inside the centre feature")
                    break
        if not d:
            continue
        for bad in ("dumpTime", "hasPower", "hasItems", "hasLiquids", "outputItems", "updateEffect"):
            if bad in d:
                err(f"{name}: must not set {bad}")
        if not REQ.match(str(d.get("outputItem", ""))) or not d.get("craftTime", 0) > 0:
            err(f"{name}: needs outputItem item/amount and craftTime > 0")
            continue
        out_n = int(d["outputItem"].split("/")[1])
        if out_n * 60 / d["craftTime"] > 12:
            err(f"{name}: outputs more than 12 items/s (dumpTime is final)")
        ins_n = [int(e.split("/")[1]) for e in d.get("consumes", {}).get("items", [])]
        if any(d.get("itemCapacity", 10) < 2 * n for n in ins_n + [out_n]):
            err(f"{name}: itemCapacity must be >= 2x every input and output amount")
        if not d.get("consumes", {}).get("power", 0) > 0:
            err(f"{name}: needs consumes.power")
        dr = d.get("drawer", [])
        if len(dr) != 2 or dr[1].get("type") != "DrawWarmupRegion" or "color" not in dr[1]:
            err(f"{name}: needs the 2-entry drawer with DrawWarmupRegion and a color")
    # logistics
    for name in ("rapid-bridge", "rapid-phase-bridge"):
        d = data.get(f"{ROOT}/content/blocks/{name}.hjson") or {}
        if not isinstance(d.get("range"), int) or d["range"] < 2 or d.get("arrowSpacing", 0) < 8 or "moveArrows" in d:
            err(f"{name}: range must be an int >= 2, arrowSpacing >= 8, no moveArrows")
        if d.get("type") == "BufferedItemBridge" and "consumes" in d:
            err(f"{name}: a BufferedItemBridge takes no power")
        if d.get("type") == "ItemBridge" and not d.get("consumes", {}).get("power", 0) > 0:
            err(f"{name}: an ItemBridge needs consumes.power")
        sprite(f"sprites/blocks/{name}.png", (32, 32), opaque=True)
        for sfx in ("-end", "-bridge", "-arrow"):
            sprite(f"sprites/blocks/{name}{sfx}.png", (32, 32))
        P = f"{ROOT}/sprites/blocks/{name}"
        if not os.path.exists(f"{P}-bridge.png"):
            continue
        end = Image.open(f"{P}-end.png").convert("RGBA")
        if end.getchannel("A").crop((0, 0, 32, 24)).getbbox() or not symmetric(end):
            err(f"{name}-end: rows 0..23 must be empty and the sprite left/right symmetric")
        br = Image.open(f"{P}-bridge.png").convert("RGBA")
        a = br.getchannel("A")
        if a.crop((0, 0, 32, 4)).getbbox() or a.crop((0, 28, 32, 32)).getbbox() or \
                a.crop((0, 4, 32, 28)).getextrema()[0] != 255 or not vsymmetric(br) or \
                any(br.crop((x, 0, x + 1, 32)).tobytes() != br.crop((0, 0, 1, 32)).tobytes() for x in range(32)):
            err(f"{name}-bridge: rows 4..27 opaque, the rest empty, all columns equal, top/bottom symmetric")
        arw = Image.open(f"{P}-arrow.png").convert("RGBA")
        bb = arw.getchannel("A").getbbox()
        if not bb or bb[0] < 12 or bb[2] > 20 or bb[1] < 8 or bb[3] > 24 or not vsymmetric(arw):
            err(f"{name}-arrow: must stay inside columns 12..19, rows 8..23, top/bottom symmetric")
    d = data.get(f"{ROOT}/content/blocks/rapid-junction.hjson") or {}
    if d and d["capacity"] / d["speed"] * 60 < 26:
        err("rapid-junction: slower than a Rapid Conveyor V")
    sprite("sprites/blocks/rapid-junction.png", (32, 32), opaque=True)
    p = f"{ROOT}/sprites/blocks/rapid-junction.png"
    if os.path.exists(p):
        j = Image.open(p).convert("RGBA")
        if not (symmetric(j) and vsymmetric(j) and j.tobytes() == j.rotate(90).tobytes()):
            err("rapid-junction sprite must be symmetric both ways and under a 90 degree turn")
    sprite("sprites/blocks/rapid-unloader.png", (32, 32), opaque=True)
    sprite("sprites/blocks/rapid-unloader-center.png", (32, 32))
    p = f"{ROOT}/sprites/blocks/rapid-unloader-center.png"
    if os.path.exists(p):
        cimg = Image.open(p).convert("RGBA")
        bb = cimg.getchannel("A").getbbox()
        if not bb or bb[0] < 10 or bb[1] < 10 or bb[2] > 22 or bb[3] > 22 or \
                any(cimg.getpixel((x, y))[3] and cimg.getpixel((x, y))[:3] != (255, 255, 255)
                    for y in range(32) for x in range(32)):
            err("rapid-unloader-center: pure white, inside columns/rows 10..21")
    sprite("sprites/blocks/rapid-vault.png", (96, 96), opaque=True)
    if os.path.exists(f"{ROOT}/sprites/blocks/rapid-vault-team.png"):
        err("rapid-vault: no -team overlay is shipped")
    # steel ammo
    for t, c in gen.T.items():
        d = data.get(f"{ROOT}/content/blocks/rapid-{t}.hjson") or {}
        ammo = d.get("ammoTypes", {})
        if (t >= 3) != ("rapid-steel" in ammo):
            err(f"rapid-{t}: rapid-steel ammo must exist exactly for tiers III-VI")
        if "rapid-steel" in ammo:
            b = ammo["rapid-steel"]
            if b.get("pierceArmor") is not True or "pierce" in b or "homingPower" in b:
                err(f"rapid-{t}: steel ammo needs pierceArmor and no pierce/homing")
            if max(c['dmg'], key=lambda i: gen.dps(c, i)) == "rapid-steel":
                err(f"rapid-{t}: steel must not be the best-DPS ammo")


HEX6 = re.compile(r"^[0-9a-f]{6}$")


def check_part7(data):
    import liquids
    import overdrive
    B = f"{ROOT}/sprites/blocks"
    blk = lambda n: data.get(f"{ROOT}/content/blocks/{n}.hjson") or {}   # noqa: E731
    # conduits
    for n, c in liquids.CONDUITS.items():
        name = f"rapid-conduit-{n}"
        d = blk(name)
        if d.get("liquidCapacity", 0) < 20 or not HEX6.match(str(d.get("botColor", ""))):
            err(f"{name}: liquidCapacity >= 20 and a 6-digit botColor")
        br = blk(str(d.get("bridgeReplacement")))
        if br.get("type") != "LiquidBridge":
            err(f"{name}: bridgeReplacement must name a mod LiquidBridge")
        for bad in ("rotate", "leaks", "junctionReplacement", "padCorners", "solid"):
            if bad in d:
                err(f"{name}: must not set {bad}")
        if os.path.exists(f"{B}/{name}.png") or any(os.path.exists(f"{B}/{name}-bottom-{k}.png") for k in range(5)):
            err(f"{name}: must not ship <name>.png or -bottom-k (vanilla fallback)")
        for k in range(5):
            path = f"sprites/blocks/{name}-top-{k}.png"
            sprite(path, (32, 32))
            if not os.path.exists(f"{ROOT}/{path}"):
                continue
            im = Image.open(f"{ROOT}/{path}").convert("RGBA").load()
            chan = liquids.channel(k)
            arr = set(liquids.arrows(k))
            for y in range(32):
                for x in range(32):
                    want_clear = (chan(x, y) and (x, y) not in arr) or (k == 1 and x + 31 - y <= 6)
                    if (im[x, y][3] == 0) != want_clear:
                        err(f"{path}: pixel {(x, y)} transparency does not match the channel")
                        break
                else:
                    continue
                break
        cap = os.path.exists(f"{B}/{name}-cap.png")
        if cap != (c['type'] == "ArmoredConduit"):
            err(f"{name}: a -cap exists exactly for the armoured conduit")
        if cap:
            ci = Image.open(f"{B}/{name}-cap.png").convert("RGBA")
            bb = ci.getchannel("A").getbbox()
            if not bb or bb[0] < 28 or bb[1] < 8 or bb[3] > 24 or not vsymmetric(ci):
                err(f"{name}-cap: only columns 28..31 x rows 8..23, top/bottom symmetric")
    # router and tank
    for name in ("rapid-liquid-router", "rapid-liquid-tank"):
        d = blk(name)
        S = d.get("size", 1) * 32
        pad = 4 * d.get("liquidPadding", 0)
        sprite(f"sprites/blocks/{name}-bottom.png", (S, S), opaque=True)
        sprite(f"sprites/blocks/{name}.png", (S, S))
        p = f"{B}/{name}.png"
        if os.path.exists(p):
            im = Image.open(p).convert("RGBA")
            a = im.getchannel("A")
            if a.getextrema()[0] == 255 or not symmetric(im):
                err(f"{name}: the top layer needs a transparent window and left/right symmetry")
            ap = a.load()
            if any(ap[x, y] == 0 and not (pad <= x <= S - 1 - pad and pad <= y <= S - 1 - pad)
                   for y in range(S) for x in range(S)):
                err(f"{name}: window outside the liquidPadding area")
            if any(ap[x, y] == 0 for x in range(S) for y in (0, S - 1)) or \
                    any(ap[x, y] == 0 for y in range(S) for x in (0, S - 1)):
                err(f"{name}: the outer ring must be opaque")
    # liquid bridges
    for name in ("rapid-liquid-bridge", "rapid-phase-conduit"):
        d = blk(name)
        unpowered = d.get("hasPower") is False and "consumes" not in d
        powered = d.get("consumes", {}).get("power", 0) > 0 and "hasPower" not in d
        if not (unpowered or powered) or d.get("liquidCapacity", 0) < 40:
            err(f"{name}: hasPower: false and no consumes, or consumes.power and no hasPower; liquidCapacity >= 40")
        if not isinstance(d.get("range"), int) or d.get("arrowSpacing", 0) < 8:
            err(f"{name}: integer range and arrowSpacing >= 8")
        for bad in ("moveArrows", "transportTime", "itemCapacity"):
            if bad in d:
                err(f"{name}: must not set {bad}")
        sprite(f"sprites/blocks/{name}.png", (32, 32), opaque=True)
        for sfx in ("-end", "-bridge", "-arrow"):
            sprite(f"sprites/blocks/{name}{sfx}.png", (32, 32))
        if os.path.exists(f"{B}/{name}-bridge.png"):
            br = Image.open(f"{B}/{name}-bridge.png").convert("RGBA")
            if not vsymmetric(br) or \
                    any(br.crop((x, 0, x + 1, 32)).tobytes() != br.crop((0, 0, 1, 32)).tobytes() for x in range(32)):
                err(f"{name}-bridge: all columns equal, top/bottom symmetric")
    # pumps
    for n, pm in liquids.PUMPS.items():
        name = f"rapid-pump-{n}"
        d = blk(name)
        S = pm['size'] * 32
        if not d.get("pumpAmount", 0) > 0 or d.get("liquidCapacity", 0) < 20 * d["pumpAmount"] * pm['size'] ** 2:
            err(f"{name}: pumpAmount > 0 and liquidCapacity >= 20 ticks of output")
        if "drawer" in d or "hasPower" in d:
            err(f"{name}: no drawer, no hasPower")
        sprite(f"sprites/blocks/{name}.png", (S, S), opaque=True)
        lp = f"{B}/{name}-liquid.png"
        if os.path.exists(lp):
            li = Image.open(lp).convert("RGBA")
            L = li.width
            if li.height != L or L % 2 or L >= S or not symmetric(li) or \
                    any(li.getpixel((x, y))[3] and li.getpixel((x, y))[:3] != (255, 255, 255)
                        for y in range(L) for x in range(L)):
                err(f"{name}-liquid: square, even, smaller than the block, pure white, symmetric")
        else:
            err(f"missing sprite {name}-liquid")
    # overdrive
    import struct
    for n, o in overdrive.OD.items():
        name = f"rapid-overdrive-{n}"
        d = blk(name)
        S = o['size'] * 32
        sb = d.get("speedBoost", 0)
        f32 = struct.unpack("f", struct.pack("f", sb))[0]
        if not sb > 1 or int(f32 * 100 - 100) != round(sb * 100 - 100):
            err(f"{name}: speedBoost must be > 1 and print exactly")
        if d.get("range", 0) < 80 or not d.get("consumes", {}).get("power", 0) > 0:
            err(f"{name}: range >= 80 (world units) and consumes.power")
        items = d.get("consumes", {}).get("items")
        if (d.get("hasBoost") is False) != isinstance(items, list):
            err(f"{name}: hasBoost: false exactly when consumes.items is an array")
        if isinstance(items, dict) and not (items.get("optional") is True and items.get("booster") is True):
            err(f"{name}: the optional booster needs optional and booster true")
        if not (HEX6.match(str(d.get("baseColor", ""))) and HEX6.match(str(d.get("phaseColor", "")))):
            err(f"{name}: 6-digit baseColor and phaseColor")
        for bad in ("canOverdrive", "hasItems", "hasPower", "reload"):
            if bad in d:
                err(f"{name}: must not set {bad}")
        sprite(f"sprites/blocks/{name}.png", (S, S), opaque=True)
        tp = f"{B}/{name}-top.png"
        if os.path.exists(tp):
            t = Image.open(tp).convert("RGBA")
            if t.width != t.height or t.width % 2 or t.width >= S or t.tobytes() != t.rotate(90).tobytes():
                err(f"{name}-top: square, even, smaller than the block, equal to its 90 degree rotation")
        else:
            err(f"missing sprite {name}-top")


_cache = {}


def class_fields(cls):
    """Field names of cls and all its superclasses (javap -p, static inspection only)."""
    names = set()
    while cls and cls != "java.lang.Object":
        if cls not in _cache:
            out = subprocess.run(["javap", "-p", "-cp", JAR, cls], capture_output=True, text=True).stdout
            fields, sup = set(), None
            for line in out.splitlines():
                m = re.match(r"^\S.*\bclass\s+\S+\s+extends\s+(\S+?)(\s+implements.*)?\s*\{", line)
                if m and sup is None:
                    sup = m.group(1)
                s = line.strip()
                if s.endswith(";") and "(" not in s:
                    m = re.search(r"(\w+)(\s*=.*)?;$", s)
                    if m:
                        fields.add(m.group(1))
            _cache[cls] = (fields, sup)
        f, cls = _cache[cls]
        names |= f
    return names


SKIP = {"type", "name", "description", "research", "consumes", "requirements", "category"}
CLASSES = {"Wall": "mindustry.world.blocks.defense.Wall", "Drill": "mindustry.world.blocks.production.Drill",
           "UnitFactory": "mindustry.world.blocks.units.UnitFactory",
           "ItemTurret": "mindustry.world.blocks.defense.turrets.ItemTurret",
           "mech": "mindustry.type.UnitType", "flying": "mindustry.type.UnitType", "naval": "mindustry.type.UnitType", "legs": "mindustry.type.UnitType",
           "Conveyor": "mindustry.world.blocks.distribution.Conveyor",
           "PowerTurret": "mindustry.world.blocks.defense.turrets.PowerTurret",
           "ShieldWall": "mindustry.world.blocks.defense.ShieldWall",
           "MendProjector": "mindustry.world.blocks.defense.MendProjector",
           "ConsumeGenerator": "mindustry.world.blocks.power.ConsumeGenerator",
           "SolarGenerator": "mindustry.world.blocks.power.SolarGenerator",
           "Battery": "mindustry.world.blocks.power.Battery",
           "GenericCrafter": "mindustry.world.blocks.production.GenericCrafter",
           "Junction": "mindustry.world.blocks.distribution.Junction",
           "BufferedItemBridge": "mindustry.world.blocks.distribution.BufferedItemBridge",
           "ItemBridge": "mindustry.world.blocks.distribution.ItemBridge",
           "Unloader": "mindustry.world.blocks.storage.Unloader",
           "StorageBlock": "mindustry.world.blocks.storage.StorageBlock",
           "item": "mindustry.type.Item",
           "Conduit": "mindustry.world.blocks.liquid.Conduit",
           "ArmoredConduit": "mindustry.world.blocks.liquid.ArmoredConduit",
           "LiquidRouter": "mindustry.world.blocks.liquid.LiquidRouter",
           "LiquidBridge": "mindustry.world.blocks.liquid.LiquidBridge",
           "Pump": "mindustry.world.blocks.production.Pump",
           "OverdriveProjector": "mindustry.world.blocks.defense.OverdriveProjector"}
BULLETS = {"BasicBulletType": "mindustry.entities.bullet.BasicBulletType",
           "LaserBoltBulletType": "mindustry.entities.bullet.LaserBoltBulletType",
           "FlakBulletType": "mindustry.entities.bullet.FlakBulletType",
           "ArtilleryBulletType": "mindustry.entities.bullet.ArtilleryBulletType"}
CONSUMES = {"item", "items", "itemFlammable", "itemRadioactive", "itemCharged", "itemExplosive", "itemExplode", "liquid",
            "liquids", "liquidFlammable", "coolant", "power", "powerBuffered"}
CONSUMER_CLASS = {"itemFlammable": "mindustry.world.consumers.ConsumeItemFlammable",
                  "itemRadioactive": "mindustry.world.consumers.ConsumeItemRadioactive",
                  "liquid": "mindustry.world.consumers.ConsumeLiquid",
                  "items": "mindustry.world.consumers.ConsumeItems"}
PATTERN = "mindustry.entities.pattern."
EFFECT_KEYS = {"shootEffect", "smokeEffect", "ammoUseEffect", "hitEffect", "despawnEffect", "ejectEffect", "trailEffect",
               "generateEffect", "craftEffect"}
WEAPON = "mindustry.type.Weapon"
BULLET = "mindustry.entities.bullet.BasicBulletType"


def check_keys(obj, cls, where):
    known = class_fields(cls)
    if not known:
        err(f"{where}: no fields found for {cls} (javap failed?)")
        return
    for k in obj:
        if k not in SKIP and k not in known:
            err(f"{where}: '{k}' is not a field of {cls} or its superclasses")


def check_fields(data):
    for f, d in data.items():
        rel = os.path.relpath(f, ROOT)
        cls = CLASSES.get("item" if "/content/items/" in f else d.get("type"))
        if not cls:
            err(f"{rel}: unknown type {d.get('type')!r}")
            continue
        check_keys(d, cls, rel)
        for w in d.get("weapons", []):
            check_keys(w, WEAPON, rel + " weapon")
            if isinstance(w.get("bullet"), dict):
                check_keys(w["bullet"], BULLETS.get(w["bullet"].get("type"), BULLET), rel + " weapon bullet")
            if isinstance(w.get("shoot"), dict):
                check_keys(w["shoot"], PATTERN + w["shoot"].get("type", "ShootPattern"), rel + " weapon shoot")
        bullets = []
        if d.get("type") == "ItemTurret":
            bullets = [(f"ammo {i}", b) for i, b in d.get("ammoTypes", {}).items()]
            items = static_names("mindustry.content.Items")
            for i in d.get("ammoTypes", {}):
                if i.replace("-", "") not in {x.lower() for x in items} and \
                        not os.path.exists(f"{ROOT}/content/items/{i}.hjson"):
                    err(f"{rel}: ammo key {i!r} is not an item")
        if d.get("type") == "PowerTurret":
            bullets = [("shootType", d.get("shootType", {}))]
            if not d.get("consumes", {}).get("power", 0) > 0:
                err(f"{rel}: PowerTurret without consumes.power")
        for label, b in bullets:
            check_keys(b, BULLETS.get(b.get("type"), BULLET), f"{rel} {label}")
            if "turret" in d.get("category", "") and b.get("speed", 0) * b.get("lifetime", 0) < d.get("range", 0) * 0.98:
                err(f"{rel} {label}: speed*lifetime {b.get('speed', 0) * b.get('lifetime', 0)} < range {d.get('range')}")
        if isinstance(d.get("shoot"), dict):
            check_keys(d["shoot"], PATTERN + d["shoot"].get("type", "ShootPattern"), rel + " shoot")
        fx, snd = static_names("mindustry.content.Fx"), static_names("mindustry.gen.Sounds")
        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in EFFECT_KEYS and isinstance(v, str) and v not in fx:
                        err(f"{rel}: effect {v!r} does not exist")
                    if k in ("shootSound", "ambientSound") and v not in snd:
                        err(f"{rel}: sound {v!r} does not exist")
                    walk(v)
            elif isinstance(o, list):
                for e in o:
                    walk(e)
        walk(d)
        for i, dr in enumerate(d.get("drawer", []) if isinstance(d.get("drawer"), list) else []):
            check_keys(dr, "mindustry.world.draw." + dr.get("type", "DrawDefault"), f"{rel} drawer {i}")
        if isinstance(d.get("consumes"), dict):
            for k, v in d["consumes"].items():
                if k not in CONSUMES:
                    err(f"{rel}: consumes key {k!r} is not accepted by the parser")
                if k in CONSUMER_CLASS and isinstance(v, dict):
                    check_keys(v, CONSUMER_CLASS[k], f"{rel} consumes {k}")
        if d.get("status") or any(isinstance(b, dict) and b.get("status") for b in d.get("ammoTypes", {}).values()):
            st = static_names("mindustry.content.StatusEffects")
            for b in d.get("ammoTypes", {}).values():
                if b.get("status") and b["status"] not in st:
                    err(f"{rel}: status {b['status']!r} does not exist")
        if d.get("type") == "MendProjector":
            for k, v in (("range", 2), ("phaseBoost", 0), ("phaseRangeBoost", 0)):
                if d.get(k) != v:
                    err(f"{rel}: MendProjector wall needs {k}: {v}")


def static_names(cls):
    """Public static field names of a game class (javap, static inspection only)."""
    if cls not in _cache:
        out = subprocess.run(["javap", "-p", "-cp", JAR, cls], capture_output=True, text=True).stdout
        _cache[cls] = ({m.group(1) for m in re.finditer(r"static\b.*?(\w+);", out)}, None)
    return _cache[cls][0]


if __name__ == "__main__":
    sys.exit(main())
