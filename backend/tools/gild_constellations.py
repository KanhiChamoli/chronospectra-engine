"""Re-gild constellation art: remap ALL opaque pixels onto a luminous
ivory-gold ramp (dark strokes stay as soft bronze outlines)."""
import os
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[2] / "frontend" / "public" / "constellations"

# destination ramp: deep bronze -> ivory
DARK = (122, 106, 78)     # bronze shadow
LIGHT = (255, 243, 214)   # ivory highlight


def process(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            t = min(1.0, lum / 210.0)  # everything maps onto the ramp
            nr = int(DARK[0] + (LIGHT[0] - DARK[0]) * t)
            ng = int(DARK[1] + (LIGHT[1] - DARK[1]) * t)
            nb = int(DARK[2] + (LIGHT[2] - DARK[2]) * t)
            px[x, y] = (nr, ng, nb, a)
    tmp = path.with_suffix(".tmp.png")
    img.save(tmp)
    os.replace(tmp, path)
    print("regilded", path.name)


for png in sorted(SRC.glob("*.png")):
    process(png)
print("done")
