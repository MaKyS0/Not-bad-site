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

    files = sorted(glob.glob(f"{ROOT}/content/blocks/*.hjson") + glob.glob(f"{ROOT}/content/units/*.hjson"))
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
        for s in ("-rotator", "-top", "-item"):
            sprite(f"sprites/blocks/rapid-drill-{n}{s}.png", (S, S))
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
        kind = "unit" if "/content/units/" in f else "block"
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
           "mech": "mindustry.type.UnitType", "flying": "mindustry.type.UnitType",
           "Conveyor": "mindustry.world.blocks.distribution.Conveyor"}
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
        cls = CLASSES.get(d.get("type"))
        if not cls:
            err(f"{rel}: unknown type {d.get('type')!r}")
            continue
        check_keys(d, cls, rel)
        for w in d.get("weapons", []):
            check_keys(w, WEAPON, rel + " weapon")
            if isinstance(w.get("bullet"), dict):
                check_keys(w["bullet"], BULLET, rel + " weapon bullet")
        if d.get("type") == "ItemTurret":
            for item, b in d.get("ammoTypes", {}).items():
                check_keys(b, BULLET, f"{rel} ammo {item}")


if __name__ == "__main__":
    sys.exit(main())
