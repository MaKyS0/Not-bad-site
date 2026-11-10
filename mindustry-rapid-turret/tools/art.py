"""Shared pixel-art helpers and tier palette for the Rapid mod generators."""
from PIL import Image, ImageDraw, ImageChops, ImageFilter

# tier -> (accent, metal (light plate), steel (dark plate)); DESIGN.md section 1
TIER = {
    1: ((255, 190, 80), (152, 154, 164), (110, 112, 128)),
    2: ((90, 215, 255), (146, 158, 176), (98, 108, 132)),
    3: ((120, 255, 150), (150, 164, 156), (96, 114, 110)),
    4: ((255, 110, 215), (160, 152, 172), (104, 94, 124)),
    5: ((255, 84, 60), (168, 150, 148), (92, 76, 80)),
}
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


def shade(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def mix(a, b, k):
    return tuple(int(round(a[i] * (1 - k) + b[i] * k)) for i in range(3))


def hexc(c):
    return '"%02x%02x%02x"' % tuple(c[:3])   # quoted, so hjson never reads it as a number


class Art:
    """Tiny pixel-art helper: everything is mirrored left<->right and gets a vertical bevel."""

    def __init__(self, S, H=None):
        self.S = S
        self.W = S
        self.H = H or S
        self.im = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))

    def mask(self):
        m = Image.new("L", (self.W, self.H), 0)
        return m, ImageDraw.Draw(m)

    def sym(self, m):
        return ImageChops.lighter(m, m.transpose(Image.FLIP_LEFT_RIGHT))

    def shift(self, m, dy):
        out = Image.new("L", m.size, 0)
        out.paste(m, (0, dy))
        return out

    def fill(self, m, col):
        self.im.paste(tuple(col[:3]) + (255,), mask=m)

    def plate(self, m, col, depth=2, hi=1, sym=True):
        """Fill mask: dark rim at the bottom edge, light rim at the top edge."""
        if sym:
            m = self.sym(m)
        self.fill(m, shade(col, 0.70))
        self.fill(ImageChops.multiply(m, self.shift(m, -depth)), col)
        if hi:
            self.fill(ImageChops.multiply(m, ImageChops.invert(self.shift(m, hi))), shade(col, 1.2))
        return m

    def flat(self, m, col, sym=True):
        if sym:
            m = self.sym(m)
        self.fill(m, col)
        return m

    def sunk(self, m, col, depth=1, sym=True):
        """Recessed panel: bevel inverted (dark top edge, light bottom edge)."""
        if sym:
            m = self.sym(m)
        self.fill(m, col)
        self.fill(ImageChops.multiply(m, ImageChops.invert(self.shift(m, depth))), shade(col, 0.65))
        self.fill(ImageChops.multiply(m, ImageChops.invert(self.shift(m, -depth))), shade(col, 1.25))
        return m

    # shapes take pixel coords (inclusive); for mirrored art pass the LEFT half
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

    def cham(self, x0, y0, x1, y1, ch):
        """Full rectangle with all four corners chamfered by ch."""
        return self.poly([(x0 + ch, y0), (x1 - ch, y0), (x1, y0 + ch), (x1, y1 - ch),
                          (x1 - ch, y1), (x0 + ch, y1), (x0, y1 - ch), (x0, y0 + ch)])

    def where(self, pred, box=None):
        """Mask of every pixel whose centre (x+.5, y+.5) satisfies pred."""
        m, _ = self.mask()
        px = m.load()
        x0, y0, x1, y1 = box or (0, 0, self.W, self.H)
        for y in range(max(0, y0), min(self.H, y1)):
            for x in range(max(0, x0), min(self.W, x1)):
                if pred(x + 0.5, y + 0.5):
                    px[x, y] = 255
        return m

    def round_disc(self, cx, cy, r):
        return self.where(lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r)

    def octagon(self, cx, cy, ap):
        k = ap * 2 ** 0.5
        return self.where(lambda x, y: abs(x - cx) <= ap and abs(y - cy) <= ap and abs(x - cx) + abs(y - cy) <= k)

    def box(self, x0, y0, x1, y1, col):
        """Plain opaque rectangle (inclusive), no mirroring."""
        ImageDraw.Draw(self.im).rectangle((int(x0), int(y0), int(x1), int(y1)), fill=tuple(col[:3]) + (255,))

    def put(self, x, y, col):
        if 0 <= x < self.W and 0 <= y < self.H:
            self.im.putpixel((int(x), int(y)), tuple(col[:3]) + (255,))


def emblem(a, cx, cy, w, t, col):
    """Two stacked chevrons pointing up. Each is w wide and w/2 tall, the second sits w/2+1 below the first."""
    h = w // 2
    total = 2 * h + t
    y0 = int(round(cy - total / 2))
    x0 = int(round(cx - w / 2))
    for k in range(2):
        yb = y0 + k * (h + 1)
        for dx in range(w):
            d = min(dx, w - 1 - dx)
            y = yb + (h - 1 - d)
            a.box(x0 + dx, y, x0 + dx, y + t - 1, col)
    return y0, y0 + total - 1


def outlined(g, radius=4, col=(64, 64, 73)):
    """Approximates the outline Mindustry generates around turret sprites (preview/icon only)."""
    alpha = g.getchannel("A").point(lambda v: 255 if v > 0 else 0)
    grown = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    out = Image.new("RGBA", g.size, (0, 0, 0, 0))
    out.paste(col + (255,), mask=grown)
    out.alpha_composite(g)
    return out
