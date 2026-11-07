#!/usr/bin/env python3
"""Draws src/main/resources/sprites/mega-wall.png: one symmetric block for the whole 3x3 wall.

The 96x96 image is a single steel plate without seams between the nine tiles. Every feature
(hazard frame, groove, rivets, gold emblem, shading) depends only on the distance from the
centre, so the picture stays the same after a horizontal or vertical mirror and after a
90-degree turn. No randomness and no directional light are used.

Usage:  python3 -I tools/make_sprite.py src/main/resources/sprites/mega-wall.png
Only the Python standard library is used; the output is deterministic.
"""
import math
import struct
import sys
import zlib

SIZE = 96           # 3 tiles x 32 px: the scale Mindustry uses for 3x3 blocks
CENTRE = SIZE / 2   # 48: the centre lies on the border between pixels 47 and 48

FRAME_FROM = 41.5   # hazard frame: the outer 6 px (distance from the centre >= 41.5)
GROOVE_FROM = 39.5  # dark groove between the frame and the plate
GOLD_RING = (13.5, 16.5)
GOLD_CORE = 4.5
RIVET_RADIUS = 2.2
RIVET_RIM = 3.0
# Rivet centres in (|dx|, |dy|) space. The set does not change when dx and dy are swapped,
# so together with abs() this gives 8 rivets: 4 corners and 4 side centres.
RIVET_CENTRES = ((32.5, 32.5), (32.5, 0.5), (0.5, 32.5))

PLATE_CENTRE = (70, 78, 89)
PLATE_EDGE = (52, 58, 67)
GROOVE = (30, 34, 40)
HAZARD_YELLOW = (222, 166, 28)
HAZARD_BLACK = (30, 30, 30)
GOLD = (196, 156, 46)
RIVET = (176, 186, 199)
RIVET_OUTLINE = (84, 92, 104)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def pixel(x, y):
    # abs() folds the image into one quadrant, so mirrored and turned pixels get equal values.
    dx = abs(x + 0.5 - CENTRE)
    dy = abs(y + 0.5 - CENTRE)
    m = max(dx, dy)  # square distance from the centre: the frame and the rings are squares

    if m >= FRAME_FROM:
        # Chevrons: the stripes meet on the middle lines of the block.
        return HAZARD_YELLOW if (int(dx + dy) // 6) % 2 == 0 else HAZARD_BLACK
    if m >= GROOVE_FROM:
        return GROOVE
    for cx, cy in RIVET_CENTRES:
        d = math.hypot(dx - cx, dy - cy)
        if d < RIVET_RADIUS:
            return RIVET
        if d < RIVET_RIM:
            return RIVET_OUTLINE
    if m < GOLD_CORE or GOLD_RING[0] <= m < GOLD_RING[1]:
        return GOLD
    return mix(PLATE_CENTRE, PLATE_EDGE, m / GROOVE_FROM)


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
