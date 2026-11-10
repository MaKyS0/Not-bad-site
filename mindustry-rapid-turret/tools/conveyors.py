"""Rapid conveyors (rapid-conveyor-1 .. 5). DESIGN.md section 7.

Every sprite is 32x32 and drawn for a belt whose OUTPUT is on the RIGHT edge. Shapes 0..4 and animation
frames 0..3 give the 20 regions `rapid-conveyor-N-<shape>-<frame>`.
"""
from PIL import Image

from art import TIER, shade, mix

S = 32
MIX = {1: 0.25, 2: 0.35, 3: 0.5, 4: 0.65, 5: 0.8}      # arrow colour: steel*0.9 mixed toward the accent
CONV = {
    1: dict(speed=0.05, shown=7, health=50, req=[("copper", 1), ("graphite", 1)]),
    2: dict(speed=0.085, shown=12, health=70, req=[("copper", 1), ("lead", 1), ("titanium", 1), ("silicon", 1)]),
    3: dict(speed=0.115, shown=16, health=100, req=[("titanium", 1), ("silicon", 1), ("thorium", 1)]),
    4: dict(speed=0.15, shown=21, health=140, req=[("plastanium", 1), ("thorium", 1), ("silicon", 1)]),
    5: dict(speed=0.19, shown=26, health=190, req=[("plastanium", 1), ("surge-alloy", 1), ("phase-fabric", 1)]),
}
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V"}
EN_D = "Tier %d conveyor. Moves %d items per second."
RU_D = "Конвейер %d тира. Перемещает %d предметов в секунду."


def cut(x, y):
    """Shape 1: the triangle below the line (0,22)-(9,31) is transparent."""
    return y - x >= 23


class Tile:
    def __init__(self, N, shape):
        self.N, self.shape = N, shape
        self.acc, self.metal, self.steel = TIER[N]
        self.col = {}                       # (x, y) -> colour; missing = transparent
        self.rail = set()
        self.belt = set()
        self.build_static()

    # ---- static parts -------------------------------------------------------------------------
    def rail_shade(self, r):
        """r = 0 outermost row/column .. 3 next to the belt."""
        return shade(self.metal, 0.7) if r == 0 else shade(self.metal, 1.2) if r == 3 else self.metal

    def segments(self):
        starts = [5, 21] + ([13, 29] if self.N >= 4 else [])
        return [range(s, s + 6) for s in sorted(starts)]

    def put_rail(self, pix, skip_cut=True):
        for (x, y), c in pix.items():
            if skip_cut and self.shape == 1 and cut(x, y):
                continue
            self.col[(x, y)] = c
            self.rail.add((x, y))

    def hrail(self, y0, outer_top, dropped=lambda x, y: False):
        pix = {}
        for r in range(4):
            y = y0 + r if outer_top else y0 + 3 - r
            for x in range(S):
                pix[(x, y)] = self.rail_shade(r)
        for seg in self.segments():
            cells = [(x, y0 + k) for x in seg if x < S for k in (1, 2)]
            if self.shape == 1 and any(cut(x, y) for x, y in cells):
                continue                    # a segment never runs into the cut corner
            for c in cells:
                pix[c] = self.acc
        self.put_rail(pix)

    def vrail_left(self):
        pix = {}
        for x in range(4):
            for y in range(S):
                pix[(x, y)] = self.rail_shade(x)
        for seg in self.segments():
            cells = [(x, y) for y in seg if y < S for x in (1, 2)]
            if self.shape == 1 and any(cut(x, y) for x, y in cells):
                continue
            for c in cells:
                pix[c] = self.acc
        self.put_rail(pix)

    def diag(self):
        """Shape 1: the rail follows the cut; 4px thick measured along y, outermost line on the cut."""
        pix = {}
        for x in range(4, S):
            for y in range(S):
                d = y - x
                if 19 <= d <= 22:
                    pix[(x, y)] = self.rail_shade(22 - d)
        for x in (5, 6, 7):                 # one short accent segment on the two middle lines
            for d in (20, 21):
                pix[(x, x + d)] = self.acc
        self.put_rail(pix)

    def nub(self, right, bottom):
        x0 = S - 4 if right else 0
        y0 = S - 4 if bottom else 0
        for dx in range(4):
            for dy in range(4):
                x, y = x0 + dx, y0 + dy
                outer = (x == (S - 1 if right else 0)) or (y == (S - 1 if bottom else 0))
                self.col[(x, y)] = shade(self.metal, 0.7) if outer else self.metal

    def build_static(self):
        sh = self.shape
        belt = shade(self.steel, 0.5)
        for y in range(S):
            for x in range(S):
                if not (sh == 1 and cut(x, y)):
                    self.col[(x, y)] = belt
        if sh == 0:
            self.hrail(0, True)
            self.hrail(28, False)
        elif sh == 1:
            self.vrail_left()
            self.hrail(28, False)
            self.diag()
            self.nub(True, False)
        elif sh == 2:
            self.hrail(0, True)
            self.nub(False, True)
            self.nub(True, True)
        elif sh == 3:
            for r in (False, True):
                for b in (False, True):
                    self.nub(r, b)
        elif sh == 4:
            self.vrail_left()
            self.nub(True, False)
            self.nub(True, True)
        self.belt = {p for p in self.col if p not in self.rail and not self.is_nub(p)}
        if self.N == 5:                     # 1px accent line on the belt edge of each rail
            for (x, y) in sorted(self.belt):
                if any(n in self.rail for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    self.col[(x, y)] = self.acc

    def is_nub(self, p):
        x, y = p
        sh = self.shape
        corners = {1: [(1, 0)], 2: [(0, 1), (1, 1)], 3: [(0, 0), (1, 0), (0, 1), (1, 1)], 4: [(1, 0), (1, 1)]}
        for r, b in corners.get(sh, []):
            if (x >= S - 4 if r else x < 4) and (y >= S - 4 if b else y < 4):
                return True
        return False

    # ---- arrows -------------------------------------------------------------------------------
    def arrow(self, pts):
        c = mix(shade(self.steel, 0.9), self.acc, MIX[self.N])
        for p in pts:
            if p in self.belt:
                self.col[p] = c

    @staticmethod
    def chevron(tip, lane, direction, wrap=False):
        """5 long, 9 across, 2px stroke. direction r / d / u. `lane` is the fixed coordinate (centre of the lane)."""
        out = []
        for k in range(-4, 5):
            for a in (abs(k), abs(k) + 1):
                if a > 4:
                    continue
                t = tip + a if direction == "u" else tip - a
                if direction == "r":
                    out.append(((t % S) if wrap else t, lane + k))
                else:
                    out.append((lane + k, t))
        return out

    def animate(self, f):
        sh = self.shape
        main = lambda: [self.arrow(self.chevron(t + 4 * f, 16, "r", wrap=True)) for t in (6, 22)]
        up = lambda: (self.arrow(self.chevron(30 - 4 * f, 16, "u")) if 30 - 4 * f >= 22 else None)
        down = lambda: (self.arrow(self.chevron(1 + 4 * f, 16, "d")) if 1 + 4 * f <= 9 else None)
        if sh == 0:
            main()
        elif sh == 1:
            for t in (6, 22):
                s = (t + 4 * f) % 32
                self.arrow(self.chevron(s, 16, "d" if s <= 16 else "r"))
        elif sh == 2:
            main()
            up()
        elif sh == 3:
            main()
            up()
            down()
        elif sh == 4:
            up()
            down()
            self.arrow(self.chevron(18 + 4 * f, 16, "r"))

    def image(self):
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        for (x, y), c in self.col.items():
            im.putpixel((x, y), tuple(c[:3]) + (255,))
        return im


def sprite(N, shape, f):
    t = Tile(N, shape)
    t.animate(f)
    return t.image()


def hjson(N):
    c = CONV[N]
    lines = [
        "type: Conveyor",
        f"name: Rapid Conveyor {ROMAN[N]}",
        f"description: {EN_D % (N, c['shown'])}",
        "category: distribution",
        f"research: {'conveyor' if N == 1 else f'rapid-conveyor-{N - 1}'}",
        "requirements: [",
    ] + [f"  {i}/{n}" for i, n in c['req']] + [
        "]",
        f"health: {c['health']}",
        f"speed: {c['speed']}",
        f"displayedSpeed: {c['shown']}",
    ]
    return "\n".join(lines) + "\n"


def build(root):
    en, ru = [], []
    for N in CONV:
        name = f"rapid-conveyor-{N}"
        open(f"{root}/content/blocks/{name}.hjson", "w").write(hjson(N))
        for shape in range(5):
            for f in range(4):
                sprite(N, shape, f).save(f"{root}/sprites/blocks/{name}-{shape}-{f}.png")
        key = f"block.rapid-turret-{name}"
        en += [f"{key}.name = Rapid Conveyor {ROMAN[N]}", f"{key}.description = {EN_D % (N, CONV[N]['shown'])}"]
        ru += [f"{key}.name = Конвейер Rapid {ROMAN[N]}", f"{key}.description = {RU_D % (N, CONV[N]['shown'])}"]
    return en, ru
