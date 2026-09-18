#!/usr/bin/env python3
"""Erzeugt die App-Icons ohne externe Abhängigkeiten.

Gezeichnet wird eine Hantel auf dunklem Grund. Aufruf: python3 tools/make-icons.py
"""
import struct
import zlib
from pathlib import Path

BG = (15, 17, 21)
ACCENT = (79, 140, 255)
ICONS = Path(__file__).resolve().parent.parent / "icons"


def png(path, width, height, pixels):
    """pixels: Liste von Zeilen mit (r, g, b)-Tupeln."""
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("3B", *px) for px in row) for row in pixels
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def blend(under, over, alpha):
    return tuple(round(u + (o - u) * alpha) for u, o in zip(under, over))


def coverage(x, y, shapes, samples=3):
    """Anteil der Fläche eines Pixels, der in einer der Formen liegt (Antialiasing)."""
    hits = 0
    for sy in range(samples):
        for sx in range(samples):
            px = x + (sx + 0.5) / samples
            py = y + (sy + 0.5) / samples
            if any(shape(px, py) for shape in shapes):
                hits += 1
    return hits / (samples * samples)


def rounded_rect(x0, y0, x1, y1, radius):
    def inside(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        cx = min(max(x, x0 + radius), x1 - radius)
        cy = min(max(y, y0 + radius), y1 - radius)
        return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 or (
            x0 + radius <= x <= x1 - radius or y0 + radius <= y <= y1 - radius
        )

    return inside


def dumbbell(size, scale):
    """Hantel-Formen, zentriert, `scale` = Anteil der Kantenlänge."""
    c = size / 2
    w = size * scale
    bar_h = w * 0.17
    plate_w = w * 0.15
    plate_h = w * 0.62
    grip_h = w * 0.40
    r = w * 0.05
    return [
        rounded_rect(c - w / 2, c - plate_h / 2, c - w / 2 + plate_w, c + plate_h / 2, r),
        rounded_rect(c + w / 2 - plate_w, c - plate_h / 2, c + w / 2, c + plate_h / 2, r),
        rounded_rect(c - w / 2 + plate_w * 1.35, c - grip_h / 2,
                     c - w / 2 + plate_w * 2.1, c + grip_h / 2, r),
        rounded_rect(c + w / 2 - plate_w * 2.1, c - grip_h / 2,
                     c + w / 2 - plate_w * 1.35, c + grip_h / 2, r),
        rounded_rect(c - w / 2, c - bar_h / 2, c + w / 2, c + bar_h / 2, r),
    ]


def build(name, size, scale):
    shapes = dumbbell(size, scale)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            a = coverage(x, y, shapes)
            row.append(BG if a == 0 else blend(BG, ACCENT, a))
        rows.append(row)
    ICONS.mkdir(exist_ok=True)
    png(ICONS / name, size, size, rows)
    print(f"icons/{name}")


if __name__ == "__main__":
    build("icon-512.png", 512, 0.68)
    build("icon-512-maskable.png", 512, 0.52)  # Inhalt in der Safe-Zone
    build("icon-192.png", 192, 0.68)
    build("icon-180.png", 180, 0.68)
