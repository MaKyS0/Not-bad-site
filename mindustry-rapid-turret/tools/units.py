"""Rapid mech units (pellet .. storm). DESIGN.md section 4."""
from art import Art, TIER, shade, mix, hexc

GOLD = (255, 190, 80)

UNITS = [
    dict(T=1, name="pellet", health=170, armor=0, speed=0.55, hit=8, rot=6, reload=8, dmg=5, bspeed=3.5, life=32,
         C=48, gun=(16, 28, 1, 4), mx=4.75, my=0.5,
         en="Pellet", ru="Дробь",
         en_d="Tier 1 mech. A light scout with twin rapid-fire guns.",
         ru_d="Мех 1 тира. Лёгкий разведчик с двумя скорострельными пушками."),
    dict(T=2, name="burst", health=620, armor=3, speed=0.50, hit=10, rot=5, reload=6, dmg=9, bspeed=3.8, life=35,
         C=56, gun=(20, 34, 2, 3), mx=5.75, my=0.5,
         en="Burst", ru="Очередь",
         en_d="Tier 2 mech. Fires fast bursts from double-barrelled guns.",
         ru_d="Мех 2 тира. Стреляет быстрыми очередями из двуствольных пушек."),
    dict(T=3, name="volley", health=1200, armor=6, speed=0.43, hit=13, rot=4, reload=5, dmg=14, bspeed=4.2, life=39,
         C=72, gun=(24, 44, 2, 4), mx=7.5, my=1,
         en="Volley", ru="Залп",
         en_d="Tier 3 mech. An armoured line fighter that fires tracer rounds.",
         ru_d="Мех 3 тира. Бронированный боец передовой, стреляет трассирующими пулями."),
    dict(T=4, name="barrage", health=8500, armor=9, speed=0.36, hit=22, rot=3, reload=7, dmg=47, bspeed=4.8, life=42,
         C=112, gun=(34, 68, 3, 5), mx=12, my=1.5,
         en="Barrage", ru="Шквал",
         en_d="Tier 4 mech. A heavy assault walker with triple-barrel guns.",
         ru_d="Мех 4 тира. Тяжёлый штурмовой шагоход с трёхствольными пушками."),
    dict(T=5, name="storm", health=22000, armor=14, speed=0.32, hit=30, rot=2.5, reload=7, dmg=112, bspeed=5.5, life=44,
         C=144, gun=(44, 88, 4, 5), mx=15.5, my=2,
         en="Storm", ru="Шторм",
         en_d="Tier 5 mech. A colossal walker whose four-barrel guns pierce armour.",
         ru_d="Мех 5 тира. Колоссальный шагоход, чьи четырёхствольные пушки пробивают броню."),
]
RECIPES = {   # factory plans: time, requirements
    "pellet": (1200, [("silicon", 25), ("lead", 15), ("graphite", 10)]),
    "burst": (2400, [("silicon", 80), ("graphite", 50), ("titanium", 30)]),
    "volley": (4200, [("silicon", 220), ("titanium", 160), ("graphite", 120), ("thorium", 40)]),
    "barrage": (9000, [("silicon", 900), ("titanium", 750), ("plastanium", 450), ("thorium", 300)]),
    "storm": (14400, [("silicon", 1400), ("plastanium", 800), ("surge-alloy", 600), ("thorium", 500),
                      ("phase-fabric", 350)]),
}
RESEARCH = {
    "pellet": [("silicon", 500), ("lead", 300), ("graphite", 200)],
    "burst": [("silicon", 1500), ("graphite", 1000), ("titanium", 600)],
    "volley": [("silicon", 4000), ("titanium", 3000), ("graphite", 2500), ("thorium", 800)],
    "barrage": [("silicon", 12000), ("titanium", 10000), ("plastanium", 6000), ("thorium", 4000)],
    "storm": [("silicon", 20000), ("plastanium", 12000), ("surge-alloy", 9000), ("thorium", 7000),
              ("phase-fabric", 5000)],
}


def even(v):
    return 2 * int(round(v / 2))


def lr(a, cx, dx0, dx1, y0, y1):
    """Left-half rectangle spanning dx0..dx1 pixels away from the centre line (mirrored by sym)."""
    return a.rect(cx - dx1, y0, cx - dx0 - 1, y1)


def socket_geom(u):
    C = u['C']
    hw = int(round(0.07 * C))
    sh = max(4, int(round(0.07 * C)))
    cy = C // 2 - int(round(0.17 * C))
    y0 = cy - sh // 2
    return hw, y0, y0 + sh - 1


def body(u):
    T, C = u['T'], u['C']
    acc, metal, steel = TIER[T]
    a = Art(C)
    cx = cy = C // 2

    def R(v):
        return int(round(v * C))
    dp = 3 if C < 100 else 4
    big = C >= 112
    dark = shade(steel, 0.42)

    # 1. back pack with vents and glow slits
    pw = R(0.17)
    pt, pb = cy + R(0.10), cy + R(0.30) - 1
    a.plate(lr(a, cx, 0, pw, pt, pb), steel, 2)
    vh = max(3, R(0.08))
    vx = R(0.07) if T < 4 else R(0.10)
    a.flat(a.rect(cx - vx - 1, pt + 2, cx - vx - 1, pt + 1 + vh), dark)
    if T >= 4:
        a.box(cx - 1, pt + 2, cx, pt + 1 + vh, dark)
    th = 2 if big else 1
    gx0, gx1 = R(0.04), R(0.10)
    a.flat(lr(a, cx, gx0, gx1, pb - th + 1, pb), acc)

    # 4-ish. skirt plates outside the shoulders (T>=4)
    if T >= 4:
        a.plate(lr(a, cx, R(0.34), R(0.39), cy - R(0.17), cy + R(0.17)), metal, 2)

    # 2. shoulders
    s0, s1 = R(0.20), R(0.34)
    st, sb = cy - R(0.14), cy + R(0.14)
    ch = max(2, R(0.04))
    a.plate(a.poly([(cx - s1 + ch, st), (cx - s0, st), (cx - s0, sb), (cx - s1, sb), (cx - s1, st + ch)]), steel, 2)
    a.flat(a.rect(cx - s1 + ch, st + 1, cx - s0 - 2, st + th), acc)

    # 3. torso
    hw = R(0.24)
    t0, t1 = cy - R(0.22), cy + R(0.20)
    tc = R(0.08)
    a.plate(a.poly([(cx - hw + tc, t0), (cx, t0), (cx, t1), (cx - hw + tc, t1), (cx - hw, t1 - tc), (cx - hw, t0 + tc)]),
            metal, dp)
    if T >= 5:   # gold trim across the torso front
        a.flat(a.rect(cx - hw + tc, t0 + 2, cx, t0 + 1 + th), GOLD)
    # 7. spine
    if T >= 3:
        sp = even(R(0.10)) // 2
        s_top, s_bot = cy, cy + R(0.16)
        if T >= 5:
            a.flat(a.rect(cx - sp - th, s_top - th, cx, s_bot + th), GOLD)
        a.plate(a.rect(cx - sp, s_top, cx, s_bot), steel, 2)

    # 4. head
    a.plate(a.poly([(cx - R(0.11), cy - R(0.16)), (cx - R(0.07), cy - R(0.30)), (cx, cy - R(0.30)),
                    (cx, cy - R(0.16))]), metal, 2)
    # 5. cockpit socket (rounded slot)
    sw, y0, y1 = socket_geom(u)
    a.flat(a.poly([(cx - sw + 1, y0), (cx, y0), (cx, y1), (cx - sw + 1, y1), (cx - sw, y1 - 1), (cx - sw, y0 + 1)]), dark)
    # 6. tier pips
    p = 2 if C <= 112 else 4
    total = T * p + (T - 1) * p
    x = cx - total // 2
    py = cy - R(0.05) - p // 2
    for i in range(T):
        a.box(x + 2 * p * i, py, x + 2 * p * i + p - 1, py + p - 1, acc)
    return a.im


def cell(u):
    C = u['C']
    a = Art(C)
    cx = C // 2
    sw, y0, y1 = socket_geom(u)
    vy0, vy1 = y0 + 1, y1 - 1
    rows = vy1 - vy0 + 1
    low = 1 if rows < 5 else 2
    a.box(cx - sw + 1, vy0, cx + sw - 2, vy1 - low, (255, 255, 255))
    a.box(cx - sw + 1, vy1 - low + 1, cx + sw - 2, vy1, (220, 198, 198))
    return a.im


def hips(u):
    T, C = u['T'], u['C']
    acc, metal, steel = TIER[T]
    a = Art(C)
    cx = cy = C // 2
    hw = int(round(0.15 * C))
    hh = int(round(0.11 * C))
    ch = 3 if C >= 112 else 2
    a.plate(a.cham(cx - hw, cy - hh, cx + hw - 1, cy + hh - 1, ch), shade(steel, 0.8), 3 if C >= 112 else 2)
    return a.im


def leg(u):
    T, C = u['T'], u['C']
    acc, metal, steel = TIER[T]
    a = Art(C)
    cx = cy = C // 2

    def R(v):
        return int(round(v * C))
    lx = cx + R(0.17)
    sw = R(0.13)
    tw = R(0.16)
    y0, y1 = cy - R(0.20), cy + R(0.20) - 1
    x0 = lx - sw // 2
    a.plate(a.rect(x0, y0, x0 + sw - 1, y1), steel, 2, 1, sym=False)
    cap_end = y0 + (y1 - y0) // 3
    cx0 = lx - tw // 2
    a.plate(a.rect(cx0, y0, cx0 + tw - 1, cap_end), metal, 2, 1, sym=False)
    a.box(x0, cap_end + 1, x0 + sw - 1, cap_end + 1, shade(steel, 0.4))     # joint line
    a.box(cx0 + 1, y0 + 2, cx0 + tw - 2, y0 + 2, acc)                        # accent line on the toe cap
    return a.im


def gun(u):
    T = u['T']
    acc, metal, steel = TIER[T]
    W, H, n, bw = u['gun']
    a = Art(W, H)
    cx = W // 2
    M = 4
    big = H >= 60
    dp = 2 if H < 60 else 3
    dark = shade(steel, 0.62)
    rtop = int(round(0.55 * H))
    rbot = H - M - 1
    ml = max(3, int(round(0.07 * H)))
    step = 3 if T >= 5 else 2

    # barrels, centre outwards (left half, x inclusive)
    xs = []
    if n % 2:
        hb = (bw + 1) // 2
        xs.append((cx - hb, cx - 1, 0))
        brake_left = cx - hb - 1
        idx = 1
    else:
        right = cx - 3
        xs.append((right - bw + 1, right, 0))
        brake_left = right - bw + 1 - 1
        idx = 1
    while len(xs) < (n + 1) // 2:
        right = brake_left - 3
        xs.append((right - bw + 1, right, idx))
        brake_left = right - bw + 1 - 1
        idx += 1
    # n even and 2 barrels: both inner -> same length. Otherwise dist from the middle is the rank.
    for x0, x1, rank in xs:
        y0 = M + (rank * step if n > 2 else 0)     # outer barrels are shorter
        a.flat(a.rect(x0, y0 + 2, x1, rtop + 3), shade(steel, 0.78))
        if x1 - x0 >= 2:
            a.flat(a.rect(x0 + 1, y0 + 2, x1 - 1, rtop + 3), steel)
        mid = (x0 + x1) // 2
        a.flat(a.rect(mid, y0 + 2, mid, rtop + 3), shade(steel, 1.22))
        a.plate(a.rect(x0 - 1, y0, x1 + 1, y0 + ml - 1), metal, 1 if ml < 4 else 2)
        a.flat(a.rect(x0, y0 + ml, x1, y0 + ml + (1 if big else 0)), acc)

    # receiver block
    ch = 3 if big else 2
    a.plate(a.poly([(M, rtop), (cx, rtop), (cx, rbot), (M + ch, rbot), (M, rbot - ch)]), metal, dp)
    # ammo box panel
    a.plate(a.rect(M + 2, rtop + 3, cx, rbot - 3), steel, 1 if not big else 2)
    ph = rbot - 3 - (rtop + 3) + 1
    dot = 2 if big else 1
    dy = rtop + 3 + max(1, ph // 3)
    a.box(cx - 1, dy, cx, dy + dot - 1, acc)
    return a.im


def mount(u):
    """Returns the weapon mount offset in canvas pixels (x sideways, y forward)."""
    return u['mx'], u['my']


def hjson(u):
    T = u['T']
    acc = TIER[T][0]
    W, H, n, bw = u['gun']
    shoot_y = round(H / 2 / 4 - 1, 2)
    eff = "hitBulletSmall" if T <= 3 else "hitBulletBig"
    casing = "casing1" if T <= 2 else "casing2" if T <= 4 else "casing3"
    bl = [
        "type: BasicBulletType",
        f"damage: {u['dmg']}",
        f"speed: {u['bspeed']}",
        f"lifetime: {u['life']}",
        f"width: {5 + T}",
        f"height: {round(8 + T * 1.5, 2)}",
        f"frontColor: {hexc(mix(acc, (255, 255, 255), 0.7))}",
        f"backColor: {hexc(acc)}",
        f"hitEffect: {eff}",
        f"despawnEffect: {eff}",
    ]
    if T >= 3:
        bl += [f"trailLength: {3 + T}", f"trailWidth: {round(0.8 + 0.2 * T, 2)}", f"trailColor: {hexc(acc)}"]
    if T == 5:
        bl += ["pierce: true", "pierceCap: 2"]
    wl = [
        f"name: {u['name']}-gun",
        f"x: {u['mx']}",
        f"y: {u['my']}",
        "top: false",
        "mirror: true",
        "alternate: true",
        f"reload: {u['reload']}",
        f"recoil: {[0.8, 1, 1.3, 1.8, 2.4][T - 1]}",
        f"shootY: {shoot_y}",
        f"inaccuracy: {[4, 3.5, 3, 2.5, 2][T - 1]}",
        f"ejectEffect: {casing}",
        "bullet: {",
    ] + ["  " + l for l in bl] + ["}"]
    lines = [
        "type: mech",
        f"name: {u['en']}",
        f"description: {u['en_d']}",
        "research: {",
        f"  parent: {'rapid-forge' if T == 1 else UNITS[T - 2]['name']}",
        "  requirements: [",
    ] + [f"    {i}/{c}" for i, c in RESEARCH[u['name']]] + [
        "  ]",
        "}",
        f"health: {u['health']}",
        f"armor: {u['armor']}",
        f"speed: {u['speed']}",
        f"hitSize: {u['hit']}",
        f"rotateSpeed: {u['rot']}",
    ]
    if T >= 3:
        lines.append("canDrown: false")
    if T == 4:
        lines += ["mechFrontSway: 1.0", "mechStepParticles: true", "stepShake: 0.15"]
    if T == 5:
        lines += ["mechFrontSway: 1.9", "mechSideSway: 0.6", "mechStepParticles: true", "stepShake: 0.25"]
    lines += ["weapons: [", "  {"] + ["    " + l for l in _indent_nested(wl)] + ["  }", "]"]
    return "\n".join(lines) + "\n"


def _indent_nested(lines):
    """Weapon lines come with the bullet block already marked by '  ' prefixes; nothing else to do."""
    return lines


def build(root):
    en, ru = [], []
    for u in UNITS:
        n = u['name']
        open(f"{root}/content/units/{n}.hjson", "w").write(hjson(u))
        body(u).save(f"{root}/sprites/units/{n}.png")
        cell(u).save(f"{root}/sprites/units/{n}-cell.png")
        hips(u).save(f"{root}/sprites/units/{n}-base.png")
        leg(u).save(f"{root}/sprites/units/{n}-leg.png")
        gun(u).save(f"{root}/sprites/units/{n}-gun.png")
        key = f"unit.rapid-turret-{n}"
        en += [f"{key}.name = {u['en']}", f"{key}.description = {u['en_d']}"]
        ru += [f"{key}.name = {u['ru']}", f"{key}.description = {u['ru_d']}"]
    return en, ru
