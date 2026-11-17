"""Convert Stellarium constellation art PNGs to transparent backgrounds.

Stellarium art is drawn as bright strokes on opaque near-black; key out dark
pixels with a luminance-based alpha so the drawings float on any backdrop.
"""
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[2] / "frontend" / "public" / "constellations"

THRESHOLD = 42  # luminance below this becomes fully transparent


def process(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum <= THRESHOLD:
                px[x, y] = (r, g, b, 0)
            elif lum < THRESHOLD * 2:
                # soften the edge band for a natural fade
                alpha = int(255 * (lum - THRESHOLD) / THRESHOLD)
                px[x, y] = (r, g, b, min(a, alpha))
    img.save(path)
    print("keyed", path.name)


for png in sorted(SRC.glob("*.png")):
    process(png)
print("done")
