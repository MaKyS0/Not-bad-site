#!/usr/bin/env python3
"""Draws src/main/resources/sprites/mega-wall.png: a 3x3 wall (96x96 px, 32 px per tile).

Usage:  python3 -I tools/make_sprite.py src/main/resources/sprites/mega-wall.png
Only the Python standard library is used; the output is deterministic.
"""
import struct
import sys
import zlib

SIZE = 96   # 3 tiles x 32 px, the same scale Mindustry uses for 3x3 blocks
TILE = 32

STEEL_TOP = (72, 80, 91)
STEEL_BOTTOM = (52, 58, 67)
SEAM = (28, 33, 39)
BEVEL_LIGHT = (100, 110, 122)
BEVEL_DARK = (36, 41, 48)
RIVET = (170, 180, 193)
RIVET_SHADE = (84, 92, 104)
HAZARD_YELLOW = (222, 166, 28)
HAZARD_BLACK = (30, 30, 30)
GOLD = (196, 156, 46)
RIVETS = ((7, 7), (24, 7), (7, 24), (24, 24))


def clamp(value):
    return max(0, min(255, int(value)))


def noise(x, y):
    """Deterministic value in [-3, 3]: makes the plates look worn instead of flat."""
    h = (x * 73856093) ^ (y * 19349663)
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h % 7) - 3


def mix(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3))


def pixel(x, y):
    # Outer frame: 3 px of diagonal hazard stripes, makes the wall look heavy.
    edge = min(x, y, SIZE - 1 - x, SIZE - 1 - y)
    if edge < 3:
        return HAZARD_YELLOW if ((x + y) // 4) % 2 == 0 else HAZARD_BLACK

    lx, ly = x % TILE, y % TILE
    # Seams between the nine plates.
    if lx < 2 or ly < 2:
        return SEAM
    # Bevel: light on the top/left edge of each plate, dark on the bottom/right edge.
    if lx == 2 or ly == 2:
        return BEVEL_LIGHT
    if lx == TILE - 1 or ly == TILE - 1:
        return BEVEL_DARK
    # Rivets in the corners of each plate.
    for rx, ry in RIVETS:
        dx, dy = lx - rx, ly - ry
        if dx * dx + dy * dy <= 3:
            return RIVET if dx + dy <= 0 else RIVET_SHADE
    # The centre plate carries a gold frame: the "core" of the mega wall.
    if x // TILE == 1 and y // TILE == 1:
        r = max(abs(lx - 15.5), abs(ly - 15.5))
        if 5.5 <= r < 6.5 or r < 2.0:
            return GOLD
    base = mix(STEEL_TOP, STEEL_BOTTOM, ly / TILE)
    n = noise(x, y)
    return tuple(clamp(c + n) for c in base)


def png(width, height, rows):
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = b"".join(b"\x00" + bytes(row) for row in rows)  # filter type 0 on every scanline
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: make_sprite.py <output.png>")
    rows = []
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            row.extend(pixel(x, y))
            row.append(255)  # opaque
        rows.append(row)
    with open(sys.argv[1], "wb") as out:
        out.write(png(SIZE, SIZE, rows))
    print("wrote", sys.argv[1])


if __name__ == "__main__":
    main()
