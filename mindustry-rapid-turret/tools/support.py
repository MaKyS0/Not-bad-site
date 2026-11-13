"""Support line (wisp, keeper, warden) and the Rapid Workshop that builds them. DESIGN.md section 54.

The units are flying builders/healers. Their art reuses the air-unit drawing code (section 8) with a pale "medic" palette."""
import art
from art import TIER, hexc, mix
import air
import forge

HEAL = (132, 244, 145)
WHITE = (255, 255, 255)
# accent, metal (light plate), steel (dark plate) of the support line
PALETTE = (HEAL, (205, 212, 218), (132, 142, 152))

UNITS = [
    dict(T=1, name="wisp", base=0, C=48, health=300, armor=1, speed=2.8, accel=0.09, drag=0.04, hit=9, eo=5.5, es=2,
         build=0.8, mine=2, cap=40, cmd="rebuild", weapons=[(3, 0.5)], reload=25, dmg=10, heal=4, bspeed=5.2, life=30,
         en="Wisp", ru="Огонёк",
         en_d="Tier 1 support drone. Rebuilds destroyed blocks, mines and heals buildings with its bolts.",
         ru_d="Дрон поддержки 1 тира. Восстанавливает разрушенные постройки, добывает руду и чинит постройки выстрелами."),
    dict(T=2, name="keeper", base=1, C=64, health=700, armor=3, speed=2.5, accel=0.08, drag=0.04, hit=13, eo=7.5, es=2.5,
         build=1.6, mine=3, cap=60, cmd="repair", weapons=[(4.5, 0.5)], reload=16, dmg=14, heal=5, bspeed=5.4, life=32,
         en="Keeper", ru="Хранитель",
         en_d="Tier 2 support ship. Flies from one damaged building to the next and repairs it.",
         ru_d="Корабль поддержки 2 тира. Летает от одной повреждённой постройки к другой и чинит их."),
    dict(T=3, name="warden", base=2, C=96, health=1600, armor=6, speed=2.2, accel=0.06, drag=0.03, hit=20, eo=11.5, es=3.2,
         build=2.8, mine=4, cap=90, cmd="repair", weapons=[(7, 1)], reload=12, dmg=20, heal=6, bspeed=5.6, life=34,
         en="Warden", ru="Страж",
         en_d="Tier 3 support ship. Builds almost three times faster than a Poly and keeps whole walls repaired.",
         ru_d="Корабль поддержки 3 тира. Строит почти втрое быстрее Poly и держит в целости целые стены."),
]
RECIPES = {
    "wisp": (1200, [("silicon", 40), ("graphite", 20), ("titanium", 10)]),
    "keeper": (2700, [("silicon", 140), ("titanium", 90), ("metaglass", 60), ("graphite", 60)]),
    "warden": (5400, [("silicon", 400), ("titanium", 300), ("plastanium", 120), ("rapid-steel", 80)]),
}
RESEARCH = {
    "wisp": [("silicon", 800), ("graphite", 400), ("titanium", 200)],
    "keeper": [("silicon", 2600), ("titanium", 1800), ("metaglass", 1200)],
    "warden": [("silicon", 7000), ("titanium", 5000), ("plastanium", 2000), ("rapid-steel", 1200)],
}
WS_EN = "Builds the Rapid support drones: builders and medics for your base."
WS_RU = "Строит дронов поддержки Rapid — строителей и ремонтников для базы."


def art_dict(u):
    d = dict(air.UNITS[u['base']])
    d.update(name=u['name'], C=u['C'], weapons=[(f"{u['name']}-gun", x, y) for x, y in u['weapons']], turret=None)
    return d


def with_palette(fn, u):
    """Draw with the support palette in the tier slot the air code reads, then restore it."""
    t = u['T']
    old = TIER[t]
    TIER[t] = PALETTE
    try:
        return fn(art_dict(u))
    finally:
        TIER[t] = old


def hjson(u):
    lines = [
        "type: flying",
        "flying: true",
        f"name: {u['en']}",
        f"description: {u['en_d']}",
        "isEnemy: false",
        f"defaultCommand: {u['cmd']}",
        "research: {",
        f"  parent: {'rapid-workshop' if u['T'] == 1 else UNITS[u['T'] - 2]['name']}",
        "  requirements: [",
    ] + [f"    {i}/{c}" for i, c in RESEARCH[u['name']]] + [
        "  ]",
        "}",
        f"health: {u['health']}",
        f"armor: {u['armor']}",
        f"speed: {u['speed']}",
        f"accel: {u['accel']}",
        f"drag: {u['drag']}",
        f"hitSize: {u['hit']}",
        "lowAltitude: true",
        f"engineOffset: {u['eo']}",
        f"engineSize: {u['es']}",
        f"buildSpeed: {u['build']}",
        f"mineTier: {u['mine']}",
        "mineSpeed: 6",
        f"itemCapacity: {u['cap']}",
        "weapons: [",
    ]
    for x, y in u['weapons']:
        wl = [
            f"name: {u['name']}-gun",
            f"x: {x}",
            f"y: {y}",
            "top: false",
            "mirror: true",
            "alternate: true",
            f"reload: {u['reload']}",
            "inaccuracy: 2",
            "shootSound: lasershoot",
            "bullet: {",
            "  type: LaserBoltBulletType",
            f"  damage: {u['dmg']}",
            f"  speed: {u['bspeed']}",
            f"  lifetime: {u['life']}",
            f"  healPercent: {u['heal']}",
            "  collidesTeam: true",
            f"  backColor: {hexc(HEAL)}",
            '  frontColor: "ffffff"',
            "}",
        ]
        lines += ["  {"] + ["    " + l for l in wl] + ["  }"]
    lines.append("]")
    return "\n".join(lines) + "\n"


def workshop_hjson():
    return forge.hjson(name="Rapid Workshop", desc=WS_EN, research="rapid-hangar",
                       reqs=(("copper", 300), ("lead", 250), ("silicon", 250), ("titanium", 120), ("metaglass", 100)),
                       power=2.5, plans=[(u['name'],) + RECIPES[u['name']] for u in UNITS], health=1500)


def build(root):
    en, ru = [], []
    for u in UNITS:
        n = u['name']
        open(f"{root}/content/units/{n}.hjson", "w").write(hjson(u))
        with_palette(air.body, u).save(f"{root}/sprites/units/{n}.png")
        with_palette(air.cell, u).save(f"{root}/sprites/units/{n}-cell.png")
        key = f"unit.rapid-turret-{n}"
        en += [f"{key}.name = {u['en']}", f"{key}.description = {u['en_d']}"]
        ru += [f"{key}.name = {u['ru']}", f"{key}.description = {u['ru_d']}"]
    open(f"{root}/content/blocks/rapid-workshop.hjson", "w").write(workshop_hjson())
    forge.base(HEAL, "circle").save(f"{root}/sprites/blocks/rapid-workshop.png")
    forge.clamps().save(f"{root}/sprites/blocks/rapid-workshop-top.png")
    forge.notch("right", HEAL).save(f"{root}/sprites/blocks/rapid-workshop-out.png")
    forge.notch("left", HEAL).save(f"{root}/sprites/blocks/rapid-workshop-in.png")
    key = "block.rapid-turret-rapid-workshop"
    en += [f"{key}.name = Rapid Workshop", f"{key}.description = {WS_EN}"]
    ru += [f"{key}.name = Мастерская Rapid", f"{key}.description = {WS_RU}"]
    return en, ru
