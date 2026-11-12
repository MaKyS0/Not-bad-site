"""Rapid walkers T1-T5 (type: legs) — siege spiders with mortars. DESIGN.md sections 26, 27, 31.1-31.3, 32."""
from PIL import Image, ImageChops

from art import Art, TIER, shade, mix, hexc, emblem
import naval

WHITE = (255, 255, 255)
GOLD = (255, 190, 80)
CELL_LOW = (220, 198, 198)

# legs: (count, length, baseOffset, forwardScl, moveSpace, pairOffset, speed, lengthScl)  None = omit (class default)
UNITS = [
    dict(T=1, name="mite", en="Mite", ru="Клещ", health=130, armor=0, speed=0.60, drag=0.4, rot=5, hit=8, C=40,
         legs=(4, 8, 1, 0.6, 1.4, None, None, None), shadow=0.2, layer=74, extra=[],
         mortar=dict(x=2.25, y=0.5, reload=40, splash=15, radius=14, speed=3, life=57, recoil=1.5, shake=0, shootY=1.75,
                     canvas=(14, 22), bw=4, ml=2, by=12),
         flak=None, leg=dict(L=(16, 12), t=4, joint=14, r=3, foot=None),
         en_d="Tier 1 walker. A tiny spider with twin mortars. Walks over buildings; cannot hit aircraft.",
         ru_d="Шагоход 1 тира. Крошечный паук с двумя мортирами. Ходит по постройкам; не может атаковать авиацию."),
    dict(T=2, name="weaver", en="Weaver", ru="Ткач", health=480, armor=2, speed=0.55, drag=0.4, rot=4.5, hit=11, C=48,
         legs=(4, 10, 1.5, 0.6, 1.4, None, None, None), shadow=0.2, layer=74, extra=[],
         mortar=dict(x=3, y=0.5, reload=34, splash=30, radius=18, speed=3.2, life=63, recoil=2, shake=0, shootY=2.25,
                     canvas=(16, 26), bw=6, ml=2, by=14),
         flak=None, leg=dict(L=(20, 12), t=4, joint=14, r=3, foot=None),
         en_d="Tier 2 walker. Lobs explosive shells over walls from a safe distance.",
         ru_d="Шагоход 2 тира. Забрасывает разрывные снаряды через стены с безопасной дистанции."),
    dict(T=3, name="stalker", en="Stalker", ru="Ловец", health=950, armor=4, speed=0.50, drag=0.4, rot=4, hit=14, C=64,
         legs=(6, 14, 2.5, 0.8, 1.4, None, None, None), shadow=0.3, layer=75, extra=[],
         mortar=dict(x=4.25, y=1, reload=28, splash=46, radius=22, speed=3.4, life=71, recoil=2.5, shake=0.5, shootY=3,
                     canvas=(20, 32), bw=8, ml=3, by=18),
         flak=dict(x=2, y=-3.5, reload=12, dmg=3, splash=22, radius=18, speed=4.5, life=46, recoil=0.5, shootY=1.75, r=2),
         leg=dict(L=(28, 14), t=6, joint=16, r=4, foot=None),
         en_d="Tier 3 walker. Six legs, heavier mortars and a pair of flak guns against aircraft.",
         ru_d="Шагоход 3 тира. Шесть ног, тяжёлые мортиры и пара зениток против авиации."),
    dict(T=4, name="tarantula", en="Tarantula", ru="Тарантул", health=6500, armor=7, speed=0.45, drag=0.1, rot=3, hit=24,
         C=104, legs=(6, 26, 5, None, 1, 3, 0.2, 0.96), shadow=0.65, layer=75,
         extra=["stepShake: 0.5", "rippleScale: 2", "drownTimeMultiplier: 2", "legSplashDamage: 20", "legSplashRange: 20"],
         mortar=dict(x=7.25, y=2, reload=22, splash=90, radius=28, speed=3.7, life=77, recoil=3, shake=1, shootY=4.75,
                     canvas=(28, 46), bw=12, ml=4, by=25),
         flak=dict(x=2.75, y=-4, reload=10, dmg=4, splash=32, radius=22, speed=5, life=50, recoil=1, shootY=2.75, r=5),
         leg=dict(L=(52, 18), t=10, joint=22, r=7, foot=26),
         en_d="Tier 4 walker. A siege spider that out-ranges most turrets; its steps crush whatever is underfoot.",
         ru_d="Шагоход 4 тира. Осадный паук, который бьёт дальше большинства турелей; его шаги давят всё под ногами."),
    dict(T=5, name="goliath", en="Goliath", ru="Голиаф", health=17000, armor=11, speed=0.40, drag=0.1, rot=2.2, hit=32,
         C=136, legs=(6, 40, 6.5, None, 0.9, 3, 0.19, 0.94), shadow=0.9, layer=75,
         extra=["stepShake: 0.8", "rippleScale: 3", "drownTimeMultiplier: 3", "legSplashDamage: 45", "legSplashRange: 32"],
         mortar=dict(x=9.75, y=3, reload=16, splash=155, radius=34, speed=4, life=83, recoil=3.5, shake=1.5, shootY=6.5,
                     canvas=(36, 60), bw=16, ml=5, by=33),
         flak=dict(x=4, y=-5, reload=8, dmg=5, splash=46, radius=26, speed=5.5, life=54, recoil=1, shootY=2.75, r=5),
         leg=dict(L=(80, 22), t=14, joint=26, r=9, foot=34),
         en_d="Tier 5 walker. A colossal siege engine: huge blast radius, the longest range of any Rapid unit.",
         ru_d="Шагоход 5 тира. Колоссальная осадная машина: огромный радиус взрыва и самая большая дальность среди юнитов Rapid."),
]
BY_NAME = {u['name']: u for u in UNITS}

RECIPES = {
    "mite": (1350, [("silicon", 30), ("lead", 20), ("graphite", 15)]),
    "weaver": (2700, [("silicon", 90), ("graphite", 70), ("titanium", 40)]),
    "stalker": (4500, [("silicon", 240), ("titanium", 180), ("graphite", 150), ("thorium", 60)]),
    "tarantula": (9600, [("silicon", 1000), ("titanium", 850), ("plastanium", 500), ("thorium", 380)]),
    "goliath": (15000, [("silicon", 1500), ("plastanium", 900), ("surge-alloy", 680), ("thorium", 600),
                        ("phase-fabric", 380)]),
}
RESEARCH = {
    "mite": [("silicon", 550), ("lead", 350), ("graphite", 250)],
    "weaver": [("silicon", 1700), ("graphite", 1200), ("titanium", 700)],
    "stalker": [("silicon", 4300), ("titanium", 3300), ("graphite", 2700), ("thorium", 1000)],
    "tarantula": [("silicon", 13000), ("titanium", 11000), ("plastanium", 6500), ("thorium", 4800)],
    "goliath": [("silicon", 22000), ("plastanium", 13000), ("surge-alloy", 10000), ("thorium", 8000),
                ("phase-fabric", 5500)],
}


def colours(u):
    acc, metal, steel = TIER[u['T']]
    return acc, metal, steel, shade(steel, 0.45)


def th(u):
    return 1 if u['T'] <= 3 else 2


def even(v):
    return 2 * int(round(v / 2))


def flak_mounts(u):
    f = u['flak']
    return [(f['x'], f['y']), (-f['x'], f['y'])] if f else []


def socket_geom(u):
    C = u['C']
    c = C // 2
    hw = int(round(0.07 * C))
    sh = max(4, int(round(0.07 * C)))
    cy = c + int(round(-0.25 * C))
    y0 = cy - sh // 2
    return hw, y0, y0 + sh - 1


# ---------------------------------------------------------------- body + cell (31.1)

def body(u):
    T, C = u['T'], u['C']
    c = C // 2
    acc, metal, steel, dark = colours(u)
    t = th(u)
    a = Art(C)

    def R(f):
        return int(round(f * C))

    def cham_hw(hw, o0, o1, ch):
        return a.cham(c - hw, c + o0, c + hw - 1, c + o1, ch)

    # 1. abdomen, 2. carapace
    a.plate(cham_hw(R(0.26), R(-0.02), R(0.36), R(0.10)), steel, 2 if T <= 3 else 3)
    carapace = a.sym(cham_hw(R(0.18), R(0.04), R(0.30), R(0.06)))
    a.plate(carapace, metal, 2)
    if T >= 3:
        seams, sd = a.mask()
        for y in range(0, C, 8):
            sd.line((0, y, C - 1, y), fill=255)
        a.flat(ImageChops.multiply(seams, carapace), shade(metal, 0.86))
    # 3. carapace mark (T1-T2)
    if T <= 2:
        emblem(a, c, c + R(0.17), even(0.16 * C), 1, acc)
    # 4. rear spinneret
    o1 = R(0.36)
    a.flat(a.rect(c - R(0.06), c + o1 - 2 * t + 1, c - 1, c + o1), dark)
    a.flat(a.rect(c - R(0.06), c + o1 - t + 1, c - 1, c + o1), GOLD if T == 5 else acc)
    # 5. mandibles
    a.flat(a.rect(c - R(0.09), c + R(-0.40), c - R(0.05) - 1, c + R(-0.32)), steel)
    a.flat(a.rect(c - R(0.09), c + R(-0.40), c - R(0.05) - 1, c + R(-0.40) + t - 1), acc)
    # 6. head
    a.plate(a.poly([(c - R(0.12), c + R(-0.22)), (c - R(0.07), c + R(-0.34)), (c, c + R(-0.34)), (c, c + R(-0.22))]),
            metal, 2)
    # 7. thorax
    a.plate(cham_hw(R(0.20), R(-0.24), R(0.06), R(0.07)), metal, 3 if T <= 3 else 4)
    # 8. eye socket
    hw, y0, y1 = socket_geom(u)
    a.flat(a.poly([(c - hw + t, y0), (c, y0), (c, y1), (c - hw, y1), (c - hw, y0 + t)]), dark)
    # 9. tier pips (one row)
    p = 2 if T <= 3 else 4
    total = T * p + (T - 1) * p
    x0 = c - total // 2
    for i in range(T):
        a.box(x0 + i * 2 * p, c + R(-0.12), x0 + i * 2 * p + p - 1, c + R(-0.12) + p - 1, acc)
    # 10. flank plates (T4+), gold band (T5)
    if T >= 4:
        a.plate(a.rect(c - R(0.26), c + R(0.08), c - R(0.26) + 2 * t + 1, c + R(0.24)), metal, 2)
    if T == 5:
        a.flat(a.rect(c - (R(0.20) - 2 * t), c + R(-0.02), c - 1, c + R(-0.02) + t - 1), GOLD)
    # 11. flak barbettes
    if u['flak']:
        r = u['flak']['r']
        for x, y in flak_mounts(u):
            mx, my = c + 4 * x, c - 4 * y
            a.plate(a.round_disc(mx, my, r + 2), metal, 2)
            a.flat(a.round_disc(mx, my, r), shade(steel, 0.62))
            a.flat(a.round_disc(mx, my, r - 1), dark)
    return a.im


def cell(u):
    C = u['C']
    c = C // 2
    a = Art(C)
    hw, y0, y1 = socket_geom(u)
    t = th(u)
    y0, y1, hw = y0 + 1, y1 - 1, hw - 1
    n = y1 - y0 + 1
    low = int(round(n / 3))
    m = a.sym(a.poly([(c - hw + t, y0), (c, y0), (c, y1), (c - hw, y1), (c - hw, y0 + t)]))
    a.flat(m, WHITE)
    a.flat(ImageChops.multiply(m, a.rect(0, y1 - low + 1, C - 1, y1)), CELL_LOW)
    return a.im


# ---------------------------------------------------------------- legs (31.2) — symmetric top <-> bottom

def vsym(im):
    """Make an RGBA image symmetric top <-> bottom by mirroring its top half onto the bottom half."""
    W, H = im.size
    top = im.crop((0, 0, W, H // 2))
    out = im.copy()
    out.paste(top.transpose(Image.FLIP_TOP_BOTTOM), (0, H - H // 2))
    return out


def leg(u):
    acc, metal, steel, dark = colours(u)
    Lw, Lh = u['leg']['L']
    t = u['leg']['t']
    a = Art(Lw, Lh)
    y0, y1 = 4, 4 + t - 1
    a.box(0, y0, Lw - 1, y1, steel)
    a.box(0, y0, Lw - 1, y0, shade(steel, 0.78))
    a.box(0, y1, Lw - 1, y1, shade(steel, 0.78))
    a.box(0, Lh // 2 - 1, Lw - 1, Lh // 2, metal)
    x = int(round(0.3 * Lw))
    a.box(x, y0, x + th(u) - 1, y1, acc)
    return vsym(a.im)


def leg_base(u):
    acc, metal, steel, dark = colours(u)
    Lw, Lh = u['leg']['L']
    t = u['leg']['t']
    a = Art(Lw, Lh)
    y0, y1 = 4, 4 + t - 1
    e = max(1, t // 4)
    m = a.poly([(0, y0), (Lw - 1, Lh // 2 - e), (Lw - 1, Lh // 2 - 1 + e), (0, y1)])
    a.flat(m, shade(steel, 0.85), sym=False)
    a.flat(ImageChops.multiply(m, a.rect(0, Lh // 2 - 1, Lw - 1, Lh // 2)), shade(metal, 0.9), sym=False)
    if u['T'] <= 3:
        a.flat(ImageChops.multiply(m, a.rect(Lw - 3, 0, Lw - 1, Lh - 1)), acc, sym=False)
    return vsym(a.im)


def joint(u):
    acc, metal, steel, dark = colours(u)
    J, r = u['leg']['joint'], u['leg']['r']
    a = Art(J)
    a.plate(a.round_disc(J / 2, J / 2, r), metal, 1)
    a.flat(a.round_disc(J / 2, J / 2, max(1, r / 3)), dark)
    return a.im


def foot(u):
    acc, metal, steel, dark = colours(u)
    F = u['leg']['foot']
    t = u['leg']['t']
    f = F / 2
    a = Art(F)
    a.flat(a.round_disc(f, f, 0.30 * F), steel, sym=False)
    claw = a.poly([(f, f - t / 3), (F - 5, f - 1), (F - 5, f), (f, f + t / 3 - 1)])
    a.flat(claw, metal, sym=False)
    a.flat(ImageChops.multiply(claw, a.rect(F - 7, 0, F - 5, F - 1)), acc, sym=False)
    a.flat(a.round_disc(f, f, max(1, 0.10 * F)), dark, sym=False)
    return vsym(a.im)


# ---------------------------------------------------------------- mortar weapon (31.3)

def mortar_sprite(u):
    acc, metal, steel, dark = colours(u)
    m = u['mortar']
    w, h = m['canvas']
    bw, ml, by = m['bw'], m['ml'], m['by']
    t = th(u)
    tx = w // 2
    a = Art(w, h)
    x0, x1 = tx - bw // 2, tx + bw // 2 - 1
    a.flat(a.rect(x0, 4 + ml, x1, by + 1), steel)
    a.flat(a.rect(x0, 4 + ml, x0, by + 1), shade(steel, 0.78))
    a.flat(a.rect(tx - 1, 4 + ml, tx, by + 1), shade(steel, 1.22))
    a.plate(a.rect(x0 - 1, 4, x1 + 1, 4 + ml - 1), metal, 1)
    a.flat(a.rect(x0 + 1, 4, x1 - 1, 4 + max(0, ml - 2)), dark)
    a.flat(a.rect(x0, 4 + ml, x1, 4 + ml + t - 1), acc)
    ch = 2 * t
    a.plate(a.poly([(4, by), (tx, by), (tx, h - 5), (4 + ch, h - 5), (4, h - 5 - ch)]), metal, 2)
    a.plate(a.rect(x0, by + 2 * t, x1, h - 6 - t), steel, 1)
    hy = (by + 2 * t + h - 6 - t) // 2
    a.box(tx - t, hy, tx + t - 1, hy + t - 1, acc) if t > 1 else a.box(tx - 1, hy, tx, hy, acc)
    return a.im


# ---------------------------------------------------------------- hjson

def mortar_bullet(u):
    T = u['T']
    m = u['mortar']
    acc = TIER[T][0]
    size = [9, 10, 11, 13, 15][T - 1]
    eff = "flakExplosion" if T <= 3 else "blastExplosion"
    return [
        "type: ArtilleryBulletType",
        f"damage: {int(round(m['splash'] / 5))}",
        f"splashDamage: {m['splash']}",
        f"splashDamageRadius: {m['radius']}",
        f"speed: {m['speed']}",
        f"lifetime: {m['life']}",
        "knockback: 0.8",
        "collidesTiles: false",
        f"width: {size}",
        f"height: {size}",
        f"frontColor: {hexc(mix(acc, WHITE, 0.7))}",
        f"backColor: {hexc(acc)}",
        "trailEffect: none",
        f"trailLength: {[6, 7, 8, 10, 12][T - 1]}",
        f"trailWidth: {[1.5, 1.8, 2, 2.5, 3][T - 1]}",
        f"trailColor: {hexc(acc)}",
        f"hitEffect: {eff}",
        f"despawnEffect: {eff}",
    ]


def flak_bullet(u):
    f = u['flak']
    acc = TIER[u['T']][0]
    return [
        "type: FlakBulletType",
        f"damage: {f['dmg']}",
        f"speed: {f['speed']}",
        f"lifetime: {f['life']}",
        f"splashDamage: {f['splash']}",
        f"splashDamageRadius: {f['radius']}",
        "width: 6",
        "height: 8",
        f"frontColor: {hexc(mix(acc, WHITE, 0.7))}",
        f"backColor: {hexc(acc)}",
        f"hitEffect: {'flakExplosion' if u['T'] <= 3 else 'flakExplosionBig'}",
    ]


def hjson(u):
    T = u['T']
    m = u['mortar']
    cnt, length, base_off, fwd, space, pair, lspeed, lscl = u['legs']
    lines = [
        "type: legs",
        f"name: {u['en']}",
        f"description: {u['en_d']}",
        "research: {",
        f"  parent: {'rapid-nest' if T == 1 else UNITS[T - 2]['name']}",
        "  requirements: [",
    ] + [f"    {i}/{c}" for i, c in RESEARCH[u['name']]] + [
        "  ]",
        "}",
        f"health: {u['health']}",
        f"armor: {u['armor']}",
        f"speed: {u['speed']}",
        f"drag: {u['drag']}",
        f"rotateSpeed: {u['rot']}",
        f"hitSize: {u['hit']}",
        "hovering: true",
        "targetAir: false",
        f"legCount: {cnt}",
        f"legLength: {length}",
        f"legBaseOffset: {base_off}",
    ]
    for key, v in (("legForwardScl", fwd), ("legMoveSpace", space), ("legPairOffset", pair), ("legSpeed", lspeed),
                   ("legLengthScl", lscl)):
        if v is not None:
            lines.append(f"{key}: {v}")
    lines += [f"shadowElevation: {u['shadow']}", f"groundLayer: {u['layer']}"] + u['extra'] + ["weapons: ["]
    wl = [
        f"name: {u['name']}-mortar",
        f"x: {m['x']}",
        f"y: {m['y']}",
        "top: true",
        "mirror: true",
        "alternate: true",
        f"reload: {m['reload']}",
        f"recoil: {m['recoil']}",
        f"shake: {m['shake']}",
        f"shootY: {m['shootY']}",
        "inaccuracy: 3",
        "velocityRnd: 0.1",
        f"ejectEffect: {'casing2' if T <= 3 else 'casing3'}",
        "shootSound: artillery",
        "bullet: {",
    ] + ["  " + l for l in mortar_bullet(u)] + ["}"]
    lines += ["  {"] + ["    " + l for l in wl] + ["  }"]
    if u['flak']:
        f = u['flak']
        wl = [
            f"name: {u['name']}-flak",
            f"x: {f['x']}",
            f"y: {f['y']}",
            "top: true",
            "mirror: true",
            "alternate: true",
            "rotate: true",
            "rotateSpeed: 9",
            "controllable: false",
            "autoTarget: true",
            f"reload: {f['reload']}",
            f"recoil: {f['recoil']}",
            f"shootY: {f['shootY']}",
            "inaccuracy: 6",
            "shootSound: shootSnap",
            "bullet: {",
        ] + ["  " + l for l in flak_bullet(u)] + ["}"]
        lines += ["  {"] + ["    " + l for l in wl] + ["  }"]
    lines.append("]")
    return "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for u in UNITS:
        n = u['name']
        open(f"{root}/content/units/{n}.hjson", "w").write(hjson(u))
        body(u).save(f"{root}/sprites/units/{n}.png")
        cell(u).save(f"{root}/sprites/units/{n}-cell.png")
        leg(u).save(f"{root}/sprites/units/{n}-leg.png")
        leg_base(u).save(f"{root}/sprites/units/{n}-leg-base.png")
        joint(u).save(f"{root}/sprites/units/{n}-joint.png")
        if u['leg']['foot']:
            foot(u).save(f"{root}/sprites/units/{n}-foot.png")
        mortar_sprite(u).save(f"{root}/sprites/units/{n}-mortar.png")
        if u['flak']:
            naval.flak(u).save(f"{root}/sprites/units/{n}-flak.png")
        key = f"unit.rapid-turret-{n}"
        en += [f"{key}.name = {u['en']}", f"{key}.description = {u['en_d']}"]
        ru += [f"{key}.name = {u['ru']}", f"{key}.description = {u['ru_d']}"]
    return en, ru
