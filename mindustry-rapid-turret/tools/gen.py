#!/usr/bin/env python3
"""Generates tier 1-5 turret definitions + sprites. Run from mod root: python3 tools/gen.py"""
import os
from PIL import Image, ImageDraw, ImageFilter

# tier: size, barrels, reload, health, range, dmg(copper,graphite,silicon), req, accent, metal
T = {
 1: dict(size=2, n=2, reload=3.0, health=800,  range=190, d=(8,14,10),   req="copper/80, graphite/60, silicon/40",
         acc=(255,190,70),  m=(150,156,170), coolant=0.2),
 2: dict(size=2, n=3, reload=2.4, health=1100, range=210, d=(11,19,14),  req="copper/120, graphite/100, silicon/80, titanium/60",
         acc=(90,220,255),  m=(140,170,200), coolant=0.25),
 3: dict(size=3, n=3, reload=1.9, health=2000, range=235, d=(15,26,19),  req="copper/200, graphite/180, silicon/150, titanium/150, thorium/60",
         acc=(110,255,150), m=(130,175,150), coolant=0.3),
 4: dict(size=4, n=4, reload=1.5, health=3600, range=265, d=(20,36,26),  req="graphite/300, silicon/250, titanium/250, thorium/150, plastanium/80",
         acc=(255,110,200), m=(170,140,185), coolant=0.4),
 5: dict(size=5, n=5, reload=1.0, health=6500, range=300, d=(28,50,36),  req="graphite/500, silicon/450, titanium/400, thorium/300, plastanium/200, surge-alloy/150",
         acc=(255,70,60),   m=(190,150,140), coolant=0.5),
}
NAMES = {1:"Rapid I", 2:"Rapid II", 3:"Rapid III", 4:"Rapid IV", 5:"Rapid V"}

def shade(c, k): return tuple(max(0, min(255, int(v*k))) for v in c)

def sprite(t, c):
    S = c['size']*32; Z = 4; W = S*Z
    im = Image.new("RGBA", (W, W), (0,0,0,0)); d = ImageDraw.Draw(im)
    m, acc, n = c['m'], c['acc'], c['n']
    cx = W//2
    OUT = (28,30,36,255)
    # barrels (pointing up)
    bw = int(W*(0.12 if n<4 else 0.095)); gap = int(W*(0.16 if n<4 else 0.13))
    xs = [cx + int((i-(n-1)/2)*gap) for i in range(n)]
    top = int(W*0.03); bot = int(W*0.62)
    for i, x in enumerate(xs):
        lift = int(W*0.03) if i%2 else 0   # staggered barrel lengths
        x0, x1 = x-bw//2, x+bw//2
        d.rectangle((x0-Z*2, top+lift-Z*2, x1+Z*2, bot), fill=OUT)
        d.rectangle((x0, top+lift, x1, bot), fill=shade(m,0.75)+(255,))
        d.rectangle((x0, top+lift, x0+bw//3, bot), fill=shade(m,1.15)+(255,))  # highlight
        d.rectangle((x0-Z, top+lift, x1+Z, top+lift+int(W*0.07)), fill=shade(m,0.55)+(255,))  # muzzle
        for k in range(3):  # cooling rings
            y = top+lift+int(W*0.14)+k*int(W*0.1)
            d.rectangle((x0-Z, y, x1+Z, y+Z*2), fill=shade(m,0.6)+(255,))
        d.rectangle((x-Z, top+lift+Z, x+Z, top+lift+Z*3), fill=acc+(255,))
    # body hull
    r = int(W*0.30)
    hull = [(cx-r, int(W*0.52)), (cx-int(r*0.7), int(W*0.42)), (cx+int(r*0.7), int(W*0.42)),
            (cx+r, int(W*0.52)), (cx+int(r*1.05), int(W*0.80)), (cx+int(r*0.6), int(W*0.93)),
            (cx-int(r*0.6), int(W*0.93)), (cx-int(r*1.05), int(W*0.80))]
    d.polygon(hull, fill=OUT)
    inner = [(cx+(x-cx)*0.9, int(W*0.5)+(y-int(W*0.5))*0.9) for x,y in hull]
    d.polygon(inner, fill=shade(m,0.9)+(255,))
    d.polygon([(cx+(x-cx)*0.62, int(W*0.62)+(y-int(W*0.62))*0.55) for x,y in hull], fill=shade(m,0.62)+(255,))
    # side armor plates
    for sgn in (-1, 1):
        px = cx + sgn*int(r*0.78)
        d.rectangle((px-int(W*0.04), int(W*0.58), px+int(W*0.04), int(W*0.84)), fill=shade(m,1.1)+(255,), outline=OUT, width=Z)
    # glowing core with tier colour
    cr = int(W*0.09)
    cy = int(W*0.72)
    glow = Image.new("RGBA", (W,W), (0,0,0,0)); gd = ImageDraw.Draw(glow)
    gd.ellipse((cx-cr*2, cy-cr*2, cx+cr*2, cy+cr*2), fill=acc+(150,))
    glow = glow.filter(ImageFilter.GaussianBlur(Z*3))
    im = Image.alpha_composite(im, glow); d = ImageDraw.Draw(im)
    d.ellipse((cx-cr, cy-cr, cx+cr, cy+cr), fill=OUT)
    d.ellipse((cx-cr+Z*2, cy-cr+Z*2, cx+cr-Z*2, cy+cr-Z*2), fill=acc+(255,))
    d.ellipse((cx-Z*3, cy-Z*3, cx+Z, cy+Z), fill=(255,255,255,230))
    # tier pips
    for i in range(c['tier']):
        px = cx + int((i-(c['tier']-1)/2)*W*0.055)
        d.rectangle((px-Z, int(W*0.87), px+Z, int(W*0.89)+Z), fill=acc+(255,))
    return im.resize((S,S), Image.LANCZOS)

def hjson(t, c):
    cu, gr, si = c['d']; r = c['reload']; n = c['n']
    return f"""type: ItemTurret
name: {NAMES[t]} Turret
description: Tier {t} rapid-fire turret. Fires {n} barrels at extreme speed. Feed it copper, graphite or silicon.
category: turret
alwaysUnlocked: true
playerControllable: true
requirements: [{c['req']}]
size: {c['size']}
health: {c['health']}
range: {c['range']}
reload: {r}
inaccuracy: {max(2, 7-t)}
rotateSpeed: {14+t*2}
recoil: {0.4+0.1*t}
shootY: {c['size']*2}
maxAmmo: {40+t*20}
targetAir: true
targetGround: true
coolant: {{
  type: ConsumeCoolant
  amount: {c['coolant']}
}}
shoot: {{
  type: ShootAlternate
  spread: {3+c['size']}
  barrels: {n}
}}
ammoTypes: {{
  copper: {{
    type: BasicBulletType
    damage: {cu}
    speed: 4
    lifetime: {int(c['range']/4)+8}
    width: {5+t}
    height: {9+t}
    ammoMultiplier: 3
  }}
  graphite: {{
    type: BasicBulletType
    damage: {gr}
    speed: 4.4
    lifetime: {int(c['range']/4.4)+8}
    width: {6+t}
    height: {11+t}
    reloadMultiplier: 0.85
    ammoMultiplier: 4
  }}
  silicon: {{
    type: BasicBulletType
    damage: {si}
    speed: 4.4
    lifetime: {int(c['range']/4.4)+8}
    width: {5+t}
    height: {10+t}
    homingPower: 0.08
    homingRange: 70
    reloadMultiplier: 1.3
    ammoMultiplier: 5
  }}
}}
"""

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f"{root}/content/blocks", exist_ok=True); os.makedirs(f"{root}/sprites/blocks", exist_ok=True)
b = ["# generated"]
for t, c in T.items():
    c['tier'] = t
    open(f"{root}/content/blocks/rapid-{t}.hjson", "w").write(hjson(t, c))
    sprite(t, c).save(f"{root}/sprites/blocks/rapid-{t}.png")
    b.append(f"block.rapid-turret-rapid-{t}.name = {NAMES[t]} Turret")
    b.append(f"block.rapid-turret-rapid-{t}.description = Tier {t} rapid-fire turret. Feed it copper, graphite or silicon.")
open(f"{root}/bundles/bundle.properties", "w").write("\n".join(b)+"\n")
