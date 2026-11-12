"""Rapid Nest unit factory (violet, web pad) for the walkers. DESIGN.md sections 28, 31.4. Built on forge.py."""
import forge
from walkers import UNITS, RECIPES

VIOLET = (170, 120, 255)
EN = "Builds the Rapid walkers: legged siege units that step over walls."
RU = "Строит шагоходов Rapid — осадных пауков, перешагивающих через стены."


def hjson():
    return forge.hjson(
        name="Rapid Nest", desc=EN, research="ground-factory",
        reqs=(("copper", 350), ("lead", 250), ("graphite", 200), ("silicon", 250), ("titanium", 100)),
        power=3, plans=[(u['name'],) + RECIPES[u['name']] for u in UNITS], health=1700)


def build(root):
    open(f"{root}/content/blocks/rapid-nest.hjson", "w").write(hjson())
    forge.base(VIOLET, "web").save(f"{root}/sprites/blocks/rapid-nest.png")
    forge.clamps().save(f"{root}/sprites/blocks/rapid-nest-top.png")
    forge.notch("right", VIOLET).save(f"{root}/sprites/blocks/rapid-nest-out.png")
    forge.notch("left", VIOLET).save(f"{root}/sprites/blocks/rapid-nest-in.png")
    key = "block.rapid-turret-rapid-nest"
    return ([f"{key}.name = Rapid Nest", f"{key}.description = {EN}"],
            [f"{key}.name = Гнездо Rapid", f"{key}.description = {RU}"])
