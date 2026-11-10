"""Rapid Shipyard unit factory (azure, water basin pad, floats on deep water near the shore). DESIGN.md sections 21, 22.6."""
import forge
from naval import UNITS, RECIPES

AZURE = (80, 140, 255)
EN = "Builds the Rapid warships. Can stand on deep water near the shore; the exit must face water."
RU = "Строит боевые корабли Rapid. Может стоять на глубокой воде у берега; выход должен смотреть на воду."


def hjson():
    return forge.hjson(
        name="Rapid Shipyard", desc=EN, research="naval-factory",
        reqs=(("copper", 350), ("lead", 300), ("metaglass", 250), ("silicon", 220), ("graphite", 150)),
        power=3.5, plans=[(u['name'],) + RECIPES[u['name']] for u in UNITS], health=1800, extra=["floating: true"])


def build(root):
    open(f"{root}/content/blocks/rapid-shipyard.hjson", "w").write(hjson())
    forge.base(AZURE, "basin").save(f"{root}/sprites/blocks/rapid-shipyard.png")
    forge.clamps().save(f"{root}/sprites/blocks/rapid-shipyard-top.png")
    forge.notch("right", AZURE).save(f"{root}/sprites/blocks/rapid-shipyard-out.png")
    forge.notch("left", AZURE).save(f"{root}/sprites/blocks/rapid-shipyard-in.png")
    key = "block.rapid-turret-rapid-shipyard"
    return ([f"{key}.name = Rapid Shipyard", f"{key}.description = {EN}"],
            [f"{key}.name = Верфь Rapid", f"{key}.description = {RU}"])
