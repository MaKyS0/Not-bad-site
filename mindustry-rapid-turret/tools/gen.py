#!/usr/bin/env python3
"""Generates the tier 1-6 turret definitions, sprites and bundles.

Run from anywhere: python3 tools/gen.py   (needs Pillow)

Sprite notes (how Mindustry draws a turret):
  <name>.png       rotating gun, pointing UP. Drawn WITHOUT an outline: the game adds a
                   4px dark outline itself, so every sprite keeps a 5px empty margin.
  <name>-heat.png  white mask, drawn additively in `heatColor` while the turret fires.
  <name>-base.png  static plate under the gun.
"""
import os
from PIL import Image, ImageDraw, ImageChops, ImageFilter

MARGIN = 5

T = {
    1: dict(size=2, n=2, bw=6, pitch=12, step=0, reload=3.0, shots=1, health=800, range=190,
            dmg=dict(copper=8, graphite=14, silicon=10),
            req="copper/80, graphite/60, silicon/40",
            metal=(152, 154, 164), steel=(110, 112, 128), acc=(255, 190, 80), trim=None, coolant=0.2),
    2: dict(size=2, n=3, bw=6, pitch=10, step=3, reload=2.4, shots=1, health=1100, range=210,
            dmg=dict(copper=11, graphite=19, silicon=14),
            req="copper/120, graphite/100, silicon/80, titanium/60",
            metal=(146, 158, 176), steel=(98, 108, 132), acc=(90, 215, 255), trim=None, coolant=0.25),
    3: dict(size=3, n=3, bw=8, pitch=15, step=5, reload=1.9, shots=1, health=2000, range=235,
            dmg=dict(copper=15, graphite=26, silicon=19),
            req="copper/200, graphite/180, silicon/150, titanium/150, thorium/60",
            metal=(150, 164, 156), steel=(96, 114, 110), acc=(120, 255, 150), trim=None, coolant=0.3),
    4: dict(size=4, n=4, bw=10, pitch=17, step=5, reload=1.5, shots=1, health=3600, range=265,
            dmg=dict(copper=20, graphite=36, silicon=26, thorium=48),
            req="graphite/300, silicon/250, titanium/250, thorium/150, plastanium/80",
            metal=(160, 152, 172), steel=(104, 94, 124), acc=(255, 110, 215), trim=None, coolant=0.4),
    5: dict(size=5, n=5, bw=10, pitch=19, step=6, reload=1.0, shots=1, health=6500, range=300,
            dmg=dict(copper=28, graphite=50, silicon=36, thorium=66),
            req="graphite/500, silicon/450, titanium/400, thorium/300, plastanium/200, surge-alloy/150",
            metal=(168, 150, 148), steel=(92, 76, 80), acc=(255, 84, 60), trim=(255, 190, 80), coolant=0.5),
    6: dict(size=6, n=6, bw=12, pitch=20, step=6, reload=1.0, shots=2, health=12000, range=340,
            dmg=dict(copper=36, graphite=64, silicon=46, thorium=90, **{"surge-alloy": 80}),
            req="silicon/700, titanium/600, thorium/500, plastanium/350, surge-alloy/300, phase-fabric/150",
            metal=(226, 224, 238), steel=(74, 70, 106), acc=(150, 120, 255), trim=(255, 208, 96), coolant=0.6),
}
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}
RU_DESC = {
    1: "Скорострельная турель 1 тира. Два ствола, огромный темп огня.",
    2: "Скорострельная турель 2 тира. Три ствола, выше урон и дальность.",
    3: "Скорострельная турель 3 тира. Тяжёлые стволы и трассирующие пули.",
    4: "Скорострельная турель 4 тира. Четыре ствола, принимает торий.",
    5: "Скорострельная турель 5 тира. Пять стволов, выстрел каждый тик.",
    6: "Вершина линейки. Шесть стволов, два выстрела за тик, пули из кинетического сплава бьют молниями.",
}
EN_DESC = {
    1: "Tier 1 rapid-fire turret. Two barrels and a huge rate of fire.",
    2: "Tier 2 rapid-fire turret. Three barrels, more damage and range.",
    3: "Tier 3 rapid-fire turret. Heavy barrels and tracer rounds.",
    4: "Tier 4 rapid-fire turret. Four barrels, accepts thorium.",
    5: "Tier 5 rapid-fire turret. Five barrels, one shot every tick.",
    6: "Top of the line. Six barrels, two shots per tick, surge rounds arc lightning.",
}


def shade(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def mix(a, b, k):
    return tuple(int(round(a[i] * (1 - k) + b[i] * k)) for i in range(3))


def hexc(c):
    return '"%02x%02x%02x"' % tuple(c[:3])   # quoted, so hjson never reads it as a number


class Art:
    """Tiny pixel-art helper: everything is mirrored left<->right and gets a vertical bevel."""

    def __init__(self, S):
        self.S = S
        self.im = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    def mask(self):
        m = Image.new("L", (self.S, self.S), 0)
        return m, ImageDraw.Draw(m)

    def sym(self, m):
        return ImageChops.lighter(m, m.transpose(Image.FLIP_LEFT_RIGHT))

    def shift(self, m, dy):
        out = Image.new("L", m.size, 0)
        out.paste(m, (0, dy))
        return out

    def fill(self, m, col):
        self.im.paste(tuple(col[:3]) + (255,), mask=m)

    def plate(self, m, col, depth=2, hi=1):
        """Fill mask: dark rim at the bottom edge, light rim at the top edge."""
        m = self.sym(m)
        self.fill(m, shade(col, 0.70))
        self.fill(ImageChops.multiply(m, self.shift(m, -depth)), col)
        if hi:
            self.fill(ImageChops.multiply(m, ImageChops.invert(self.shift(m, hi))), shade(col, 1.2))
        return m

    def flat(self, m, col):
        m = self.sym(m)
        self.fill(m, col)
        return m

    # shapes take pixel coords of the LEFT half (x measured from the left edge)
    def poly(self, pts):
        m, d = self.mask()
        d.polygon([(int(round(x)), int(round(y))) for x, y in pts], fill=255)
        return m

    def rect(self, x0, y0, x1, y1):
        m, d = self.mask()
        d.rectangle((int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))), fill=255)
        return m

    def disc(self, cx, cy, r):
        m, d = self.mask()
        d.ellipse((cx - r, cy - r, cx + r - 1, cy + r - 1), fill=255)
        return m


def barrel_xs(c, S):
    """Left edge of every barrel on the left half (plus the centre one when n is odd)."""
    n, bw, pitch = c['n'], c['bw'], c['pitch']
    out = []
    for i in range((n + 1) // 2):
        off = (i - (n - 1) / 2) * pitch            # centre offset, <= 0
        dist = abs(i - (n - 1) / 2)
        out.append((int(round(S / 2 + off - bw / 2)), dist))
    return out


def muzzle_top(c, dist):
    return MARGIN + int(round(dist * c['step']))


def gun(t, c):
    S = c['size'] * 32
    a = Art(S)
    cx = S / 2
    metal, steel, acc = c['metal'], c['steel'], c['acc']
    trim = c['trim'] or acc
    dark = shade(steel, 0.62)
    n, bw = c['n'], c['bw']
    big = S >= 96
    dp = 2 if S < 128 else 3                       # bevel depth

    hw = int(S * (0.30 if t < 4 else 0.27))        # hull half width
    hull_top, hull_bot = int(S * 0.47), S - MARGIN - int(S * 0.05)
    base_y = int(S * 0.55)                         # where barrels disappear into the mantlet

    # --- rear exhaust block
    ew = int(S * 0.13)
    a.plate(a.rect(cx - ew, hull_bot - 4, cx + ew, S - MARGIN - 1), steel, dp)
    for k in range(2 if S < 128 else 3):
        x = cx - ew + 3 + k * max(4, ew // 2)
        a.flat(a.rect(x, S - MARGIN - 4, x + max(1, ew // 4), S - MARGIN - 3), acc)

    # --- side pods / wings (behind the hull)
    if t >= 2:
        pw = int(S * (0.07 + 0.012 * t))
        px0 = cx - hw - pw
        top = int(S * (0.50 - 0.035 * (t - 2)))
        a.plate(a.poly([(px0, top + pw), (px0 + pw, top), (cx - hw + 3, top), (cx - hw + 3, int(S * 0.86)),
                        (px0 + pw // 2, int(S * 0.86)), (px0, int(S * 0.80))]), steel, dp)
        # vent slits
        for k in range(2 + (t >= 4) + (t >= 6)):
            y = int(S * 0.64) + k * (3 if S < 128 else 5)
            a.flat(a.rect(px0 + 2, y, px0 + pw - 2, y + (0 if S < 128 else 1)), dark)
        # accent strip along the pod
        a.flat(a.rect(px0 + pw // 2, top + pw // 2 + 2, px0 + pw // 2 + (0 if S < 128 else 1), int(S * 0.60)), trim)
    if t >= 4:
        # forward shoulder armour hugging the barrels
        span = int(barrel_xs(c, S)[0][0])
        sx = span - int(S * 0.035)
        a.plate(a.poly([(sx - int(S * 0.05), int(S * 0.36)), (sx, int(S * 0.30)), (sx + 3, int(S * 0.30)),
                        (sx + 3, base_y), (sx - int(S * 0.05), base_y)]), metal, dp)
    if t >= 6:
        # swept wings
        wx = cx - hw - int(S * 0.145)
        a.plate(a.poly([(wx - int(S * 0.045), int(S * 0.74)), (wx + int(S * 0.02), int(S * 0.40)),
                        (wx + int(S * 0.06), int(S * 0.40)), (wx + int(S * 0.075), int(S * 0.84)),
                        (wx, int(S * 0.90))]), metal, dp)
        a.flat(a.poly([(wx + int(S * 0.012), int(S * 0.72)), (wx + int(S * 0.04), int(S * 0.46)),
                       (wx + int(S * 0.05), int(S * 0.46)), (wx + int(S * 0.036), int(S * 0.72))]), acc)
        a.flat(a.rect(wx - int(S * 0.02), int(S * 0.78), wx + int(S * 0.055), int(S * 0.78) + 1), trim)

    # --- barrels
    ml = max(5, int(S * 0.075))                    # muzzle brake length
    for x0, dist in barrel_xs(c, S):
        y0 = muzzle_top(c, dist)
        x1 = x0 + bw - 1
        # tube with a cylindrical highlight
        a.flat(a.rect(x0, y0 + 2, x1, base_y), shade(steel, 0.78))
        a.flat(a.rect(x0 + 1, y0 + 2, x1 - 1, base_y), steel)
        a.flat(a.rect(x0 + bw // 2 - max(1, bw // 6), y0 + 2, x0 + bw // 2 + max(1, bw // 6) - 1, base_y), shade(steel, 1.22))
        # muzzle brake
        a.plate(a.rect(x0 - 1, y0, x1 + 1, y0 + ml), metal, dp)
        a.flat(a.rect(x0 + 1, y0 + ml // 2, x1 - 1, y0 + ml // 2 + (0 if S < 128 else 1)), dark)
        # accent band under the brake
        a.flat(a.rect(x0, y0 + ml + 2, x1, y0 + ml + (3 if S < 128 else 4)), acc)
        # clamp rings
        rings = 1 if S < 96 else 2 if S < 160 else 3
        for k in range(rings):
            y = y0 + ml + int((base_y - y0 - ml) * (k + 1) / (rings + 1))
            a.plate(a.rect(x0 - 1, y, x1 + 1, y + (2 if S < 128 else 3)), shade(metal, 0.86), 1, 1)

    # --- mantlet covering the barrel roots
    mx = barrel_xs(c, S)[0][0] - max(3, int(S * 0.03))
    m_top = int(S * 0.42)
    a.plate(a.poly([(mx + 3, m_top), (cx, m_top), (cx, base_y + 4), (mx, base_y + 4), (mx, m_top + 3)]), metal, dp)
    # tier pips
    ph, pwid, gap = (2, 2, 2) if S < 96 else (3, 3, 3) if S < 160 else (4, 4, 4)
    total = t * pwid + (t - 1) * gap
    for i in range((t + 1) // 2):
        x = int(cx - total / 2) + i * (pwid + gap)
        y = m_top + (1 if S < 128 else 6)
        a.flat(a.rect(x, y, x + pwid - 1, y + ph - 1), acc)

    # --- main hull (octagon)
    ch = int(hw * 0.42)
    a.plate(a.poly([(cx - hw + ch, hull_top), (cx, hull_top), (cx, hull_bot), (cx - hw + ch, hull_bot),
                    (cx - hw, hull_bot - ch), (cx - hw, hull_top + ch)]), metal, dp + 1)
    # raised inner plate
    iw = int(hw * 0.68)
    ic = int(iw * 0.42)
    it, ib = hull_top + int(S * 0.06), hull_bot - int(S * 0.04)
    a.plate(a.poly([(cx - iw + ic, it), (cx, it), (cx, ib), (cx - iw + ic, ib), (cx - iw, ib - ic), (cx - iw, it + ic)]),
            steel, dp)
    if big:
        # trim line around the inner plate
        a.flat(a.rect(cx - iw + ic, it + 2, cx, it + 2 + (0 if S < 160 else 1)), trim)
        # corner bolts on the hull
        b = 1 if S < 160 else 2
        for by in (hull_top + ch + 2, hull_bot - ch - 3):
            a.flat(a.rect(cx - hw + 3, by, cx - hw + 3 + b, by + b), shade(metal, 0.62))

    # --- core
    cy = int((it + ib) / 2) + 1
    rc = max(5, int(S * 0.085))
    if t >= 6:
        # energy rays behind the core
        for dx, dy in ((rc + 7, 0), (0, rc + 7)):
            a.flat(a.poly([(cx - dx - 1, cy - dy), (cx - dx / 2 - (2 if dx == 0 else 0), cy - dy / 2 - (2 if dy == 0 else 0)),
                           (cx, cy), (cx - dx / 2 + (2 if dx == 0 else 0), cy - dy / 2 + (2 if dy == 0 else 0))]), trim)
            a.flat(a.poly([(cx - dx - 1, cy + dy), (cx - dx / 2 - (2 if dx == 0 else 0), cy + dy / 2 - (2 if dy == 0 else 0)),
                           (cx, cy), (cx - dx / 2 + (2 if dx == 0 else 0), cy + dy / 2 + (2 if dy == 0 else 0))]), trim)
        a.flat(a.disc(cx, cy, rc + 4), trim)
        a.flat(a.disc(cx, cy, rc + 2), dark)
    a.flat(a.disc(cx, cy, rc), shade(metal, 0.9) if t < 6 else trim)
    a.flat(a.disc(cx, cy, rc - (1 if S < 96 else 2)), dark)
    a.flat(a.disc(cx, cy, rc - (2 if S < 96 else 4)), shade(acc, 0.8))
    a.flat(a.disc(cx, cy - 1, rc - (3 if S < 96 else 6)), acc)
    a.flat(a.disc(cx, cy - 1, max(1, rc // 3)), mix(acc, (255, 255, 255), 0.75))

    # --- heat mask: barrels glow from the muzzle down
    heat = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hm, hd = a.mask()
    for x0, dist in barrel_xs(c, S):
        y0 = muzzle_top(c, dist)
        length = m_top - y0
        for y in range(y0, m_top):
            k = 1 - (y - y0) / length
            hd.rectangle((x0, y, x0 + bw - 1, y), fill=int(255 * k ** 1.4))
    hm = a.sym(hm)
    heat.paste((255, 255, 255, 255), mask=hm)
    return a.im, heat


def base(t, c):
    S = c['size'] * 32
    a = Art(S)
    acc = c['trim'] or c['acc']
    lo, mid, hi = (78, 80, 96), (110, 112, 128), (132, 134, 148)
    ch = max(3, S // 16)                           # corner chamfer
    def octa(i):
        return a.poly([(i + ch, i), (S / 2, i), (S / 2, S - 1 - i), (i + ch, S - 1 - i), (i, S - 1 - i - ch), (i, i + ch)])
    a.plate(octa(0), mid, 2)
    e = max(3, S // 20)
    a.plate(octa(e), hi, 2)
    r = int(S * 0.16)
    a.plate(octa(r), lo, 2, 0)                     # recessed well under the gun
    # corner marks in the tier colour
    L = max(3, S // 14)
    for y in (e + 2, S - 1 - e - 3):
        a.flat(a.rect(e + ch + 1, y, e + ch + L, y + (0 if S < 128 else 1)), acc)
    # edge bolts
    b = 1 if S < 128 else 2
    for y in (S // 2 - b, ):
        a.flat(a.rect(e + 1, y, e + 1 + b, y + b), lo)
    return a.im


def bullet(t, c, item):
    acc = c['acc']
    dmg = c['dmg'][item]
    speed = {"copper": 4.0, "graphite": 4.4, "silicon": 4.4, "thorium": 5.0, "surge-alloy": 5.4}[item]
    w = {"copper": 5, "graphite": 6, "silicon": 5, "thorium": 7, "surge-alloy": 7}[item] + t
    lines = [
        "type: BasicBulletType",
        f"damage: {dmg}",
        f"speed: {speed}",
        f"lifetime: {int(c['range'] / speed) + 8}",
        f"width: {w}",
        f"height: {w + 5}",
        f"frontColor: {hexc(mix(acc, (255, 255, 255), 0.7))}",
        f"backColor: {hexc(acc)}",
        f"hitEffect: {'hitBulletBig' if t >= 4 else 'hitBulletSmall'}",
        f"despawnEffect: {'hitBulletBig' if t >= 4 else 'hitBulletSmall'}",
    ]
    if t >= 3:
        lines += [f"trailLength: {4 + t}", f"trailWidth: {round(0.9 + 0.25 * t, 2)}", f"trailColor: {hexc(acc)}"]
    if item == "copper":
        lines += ["ammoMultiplier: 3"]
    if item == "graphite":
        lines += ["ammoMultiplier: 4", "reloadMultiplier: 0.85"]
    if item == "silicon":
        lines += ["ammoMultiplier: 5", "reloadMultiplier: 1.3", "homingPower: 0.08", "homingRange: 70"]
    if item == "thorium":
        lines += ["ammoMultiplier: 4", "pierce: true", "pierceCap: 3", "knockback: 0.6"]
    if item == "surge-alloy":
        lines += ["ammoMultiplier: 5", "pierce: true", "pierceCap: 2", "lightning: 2", "lightningLength: 7",
                  f"lightningDamage: {dmg // 3}", f"lightningColor: {hexc(acc)}"]
    return "  %s: {\n%s\n  }" % (item, "\n".join("    " + l for l in lines))


def hjson(t, c):
    S = c['size'] * 32
    shoot_y = round((S / 2 - MARGIN) / 4, 2)
    ammo = "\n".join(bullet(t, c, item) for item in c['dmg'])
    reqs = "\n".join("  " + r.strip() for r in c['req'].split(","))  # one per line: hjson strings run to end of line
    return f"""type: ItemTurret
name: Rapid {ROMAN[t]}
description: {EN_DESC[t]}
category: turret
research: {'duo' if t == 1 else f'rapid-{t - 1}'}
playerControllable: true
requirements: [
{reqs}
]
size: {c['size']}
health: {c['health']}
range: {c['range']}
reload: {c['reload']}
inaccuracy: {max(1.5, 7 - t)}
rotateSpeed: {14 + t * 2}
recoil: {round(0.6 + 0.3 * t, 2)}
shake: {round(0.2 * t, 2) if t >= 4 else 0}
shootY: {shoot_y}
maxAmmo: {40 + t * 20}
targetAir: true
targetGround: true
heatColor: {hexc(c['acc'])}
shootEffect: {'shootBig' if t >= 3 else 'shootSmall'}
smokeEffect: {'shootBigSmoke' if t >= 3 else 'shootSmallSmoke'}
ammoUseEffect: {'casing1' if t < 3 else 'casing2' if t < 5 else 'casing3'}
coolant: {{
  type: ConsumeCoolant
  amount: {c['coolant']}
}}
shoot: {{
  type: ShootAlternate
  barrels: {c['n']}
  spread: {c['pitch'] / 4}
  shots: {c['shots']}
}}
ammoTypes: {{
{ammo}
}}
"""


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for sub in ("content/blocks", "sprites/blocks", "bundles"):
        os.makedirs(f"{root}/{sub}", exist_ok=True)
    en, ru = [], []
    for t, c in T.items():
        name = f"rapid-{t}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(t, c))
        g, h = gun(t, c)
        g.save(f"{root}/sprites/blocks/{name}.png")
        h.save(f"{root}/sprites/blocks/{name}-heat.png")
        base(t, c).save(f"{root}/sprites/blocks/{name}-base.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Rapid {ROMAN[t]}", f"{key}.description = {EN_DESC[t]}"]
        ru += [f"{key}.name = Rapid {ROMAN[t]}", f"{key}.description = {RU_DESC[t]}"]
    open(f"{root}/bundles/bundle.properties", "w").write("\n".join(en) + "\n")
    open(f"{root}/bundles/bundle_ru.properties", "w", encoding="utf-8").write("\n".join(ru) + "\n")

    # mod icon: the tier 6 gun on its base, with the outline the game would add
    c = T[6]
    S = c['size'] * 32
    g, _ = gun(6, c)
    icon = base(6, c).copy()
    icon.alpha_composite(outlined(g))
    icon.save(f"{root}/icon.png")


def outlined(g, radius=4, col=(64, 64, 73)):
    """Approximates the outline Mindustry generates around turret sprites (preview/icon only)."""
    alpha = g.getchannel("A").point(lambda v: 255 if v > 0 else 0)
    grown = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    out = Image.new("RGBA", g.size, (0, 0, 0, 0))
    out.paste(col + (255,), mask=grown)
    out.alpha_composite(g)
    return out


if __name__ == "__main__":
    main()
