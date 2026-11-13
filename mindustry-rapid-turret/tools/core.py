"""Rapid Core (CoreBlock, 6x6) and its core unit Vector (flying builder). DESIGN.md section 53."""
from PIL import Image, ImageChops

from art import Art, TIER, shade, mix, hexc, emblem
import air

GOLD = (255, 190, 80)
WHITE = (255, 255, 255)

CORE_EN = "The Rapid command core. Holds 18000 of every item and builds the Vector. Can be placed over any smaller core."
CORE_RU = "Командное ядро Rapid. Вмещает по 18000 каждого предмета и создаёт Вектор. Ставится поверх любого ядра поменьше."
VEC_EN = "Core unit of the Rapid Core. Builds faster than a Gamma, mines titanium and fires twin rapid guns."
VEC_RU = "Юнит ядра Rapid. Строит быстрее Гаммы, добывает титан и стреляет из двух скорострельных пушек."

# the Vector reuses the air-unit drawing code (section 8) on a 56 px canvas, recoloured to gold
VECTOR = dict(air.UNITS[2])
VECTOR.update(name="vector", C=56, weapons=[("vector-gun", 3.5, 0.5)], turret=None)


def gold(im):
    """Recolour the tier-3 green accent family to gold, keeping brightness."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and g > r + 40 and g > b + 30:
                k = g / 255
                px[x, y] = (int(GOLD[0] * k), int(GOLD[1] * k), int(GOLD[2] * k), a)
    return im


def vector_sprites():
    return gold(air.body(VECTOR)), air.cell(VECTOR)


def vector_hjson():
    acc = GOLD
    return "\n".join([
        "type: flying",
        "flying: true",
        "name: Vector",
        f"description: {VEC_EN}",
        "controller: BuilderAI",
        "isEnemy: false",
        "research: rapid-core",
        "health: 320",
        "armor: 2",
        "speed: 3.8",
        "accel: 0.12",
        "drag: 0.05",
        "rotateSpeed: 20",
        "hitSize: 12",
        "lowAltitude: true",
        "engineOffset: 6.5",
        "engineSize: 2.2",
        "mineTier: 3",
        "mineSpeed: 9",
        "buildSpeed: 1.4",
        "itemCapacity: 100",
        "weapons: [",
        "  {",
        "    name: vector-gun",
        "    x: 3.5",
        "    y: 0.5",
        "    top: false",
        "    mirror: true",
        "    alternate: true",
        "    reload: 8",
        "    inaccuracy: 2",
        "    bullet: {",
        "      type: BasicBulletType",
        "      damage: 10",
        "      speed: 4",
        "      lifetime: 55",
        "      width: 6",
        "      height: 9",
        f"      frontColor: {hexc(mix(acc, WHITE, 0.7))}",
        f"      backColor: {hexc(acc)}",
        "      buildingDamageMultiplier: 0.01",
        "      hitEffect: hitBulletSmall",
        "      despawnEffect: hitBulletSmall",
        "    }",
        "  }",
        "]",
    ]) + "\n"


# ---------------------------------------------------------------- core sprite (192 x 192)

def core_sprites():
    S = 192
    c = S // 2
    acc, metal, steel = TIER[5]
    dark = shade(steel, 0.45)
    a = Art(S)
    a.box(0, 0, S - 1, S - 1, shade(steel, 0.7))
    a.box(2, 2, S - 3, S - 3, steel)
    a.plate(a.cham(5, 5, S - 6, S - 6, 10), metal, 3)
    # four corner bastions
    for fy in (0, 1):
        y0 = 14 if not fy else S - 1 - 14 - 36
        a.plate(a.cham(14, y0, 14 + 35, y0 + 35, 6), steel, 2)
        a.sunk(a.rect(22, y0 + 8, 41, y0 + 27), dark)
        a.flat(a.rect(28, y0 + 14, 35, y0 + 21), GOLD)
    # central dome: octagon socket, ring, emblem
    a.flat(a.octagon(c, c, 52), shade(steel, 0.62))
    a.sunk(a.octagon(c, c, 48), steel)
    ring = ImageChops.subtract(a.octagon(c, c, 40), a.octagon(c, c, 36))
    a.flat(ring, GOLD)
    a.plate(a.octagon(c, c, 34), metal, 3)
    a.flat(a.round_disc(c, c, 20), dark)
    emblem(a, c, c, 22, 3, GOLD)
    # side gates (left/right) and top/bottom vents
    for y in (c - 10, c + 4):
        a.flat(a.rect(8, y, 13, y + 5), dark)
    for x in range(c - 24, c + 24, 8):
        a.box(x, 8, x + 3, 11, dark)
        a.box(x, S - 12, x + 3, S - 9, dark)
    # team colour: the ring and the four bastion lights, drawn white and tinted by the game
    team = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    lights, _ = a.mask()
    for fy in (0, 1):
        y0 = 14 if not fy else S - 1 - 14 - 36
        lights = ImageChops.lighter(lights, a.sym(a.rect(28, y0 + 14, 35, y0 + 21)))
    team.paste((255, 255, 255, 255), mask=ImageChops.lighter(a.sym(ring), lights))
    return a.im, team


def core_hjson():
    return "\n".join([
        "type: CoreBlock",
        "name: Rapid Core",
        f"description: {CORE_EN}",
        "category: effect",
        "research: core-nucleus",
        "requirements: [",
        "  copper/10000",
        "  lead/10000",
        "  silicon/7000",
        "  thorium/5000",
        "  rapid-steel/2500",
        "]",
        "researchCostMultiplier: 0.1",
        "size: 6",
        "health: 9000",
        "itemCapacity: 18000",
        "unitCapModifier: 30",
        "unitType: vector",
        "thrusterLength: 12",
    ]) + "\n"


def build(root):
    open(f"{root}/content/units/vector.hjson", "w").write(vector_hjson())
    body, cell = vector_sprites()
    body.save(f"{root}/sprites/units/vector.png")
    cell.save(f"{root}/sprites/units/vector-cell.png")
    open(f"{root}/content/blocks/rapid-core.hjson", "w").write(core_hjson())
    im, team = core_sprites()
    im.save(f"{root}/sprites/blocks/rapid-core.png")
    team.save(f"{root}/sprites/blocks/rapid-core-team.png")
    en = ["block.rapid-turret-rapid-core.name = Rapid Core", f"block.rapid-turret-rapid-core.description = {CORE_EN}",
          "unit.rapid-turret-vector.name = Vector", f"unit.rapid-turret-vector.description = {VEC_EN}"]
    ru = ["block.rapid-turret-rapid-core.name = Ядро Rapid", f"block.rapid-turret-rapid-core.description = {CORE_RU}",
          "unit.rapid-turret-vector.name = Вектор", f"unit.rapid-turret-vector.description = {VEC_RU}"]
    return en, ru
