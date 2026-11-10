"""Rapid Hangar unit factory (cyan, round landing pad). DESIGN.md section 8, 'Factory'. Built on forge.py."""
import forge
from air import UNITS, RECIPES

CYAN = (90, 215, 255)
EN = "Builds the Rapid gunships. Each unit tier needs more expensive materials."
RU = "Строит воздушные корабли Rapid. Каждый следующий тир требует более дорогих материалов."


def hjson():
    return forge.hjson(
        name="Rapid Hangar", desc=EN, research="air-factory",
        reqs=(("copper", 300), ("lead", 300), ("graphite", 150), ("silicon", 220), ("metaglass", 100)),
        power=3, plans=[(u['name'],) + RECIPES[u['name']] for u in UNITS])


def build(root):
    open(f"{root}/content/blocks/rapid-hangar.hjson", "w").write(hjson())
    forge.base(CYAN, "circle").save(f"{root}/sprites/blocks/rapid-hangar.png")
    forge.clamps().save(f"{root}/sprites/blocks/rapid-hangar-top.png")
    forge.notch("right", CYAN).save(f"{root}/sprites/blocks/rapid-hangar-out.png")
    forge.notch("left", CYAN).save(f"{root}/sprites/blocks/rapid-hangar-in.png")
    key = "block.rapid-turret-rapid-hangar"
    return ([f"{key}.name = Rapid Hangar", f"{key}.description = {EN}"],
            [f"{key}.name = Ангар Rapid", f"{key}.description = {RU}"])
