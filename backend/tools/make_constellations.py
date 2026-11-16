"""Generate transparent constellation art PNGs into frontend/public/constellations/.

Draws stylized star-line figures (Orion, Ursa Major, Cassiopeia, Cygnus,
Crux, Lyra) with glow, in cyan on transparency, using PIL only (no Cairo).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "constellations"
OUT.mkdir(parents=True, exist_ok=True)

CYAN = (0, 229, 255)
AMBER = (255, 183, 3)
WHITE = (225, 240, 250)

# Star positions normalized 0..1 plus connecting lines by index
CONSTELLATIONS = {
    "orion": {
        "stars": [(0.50, 0.06), (0.30, 0.22), (0.70, 0.24), (0.44, 0.48), (0.52, 0.50), (0.60, 0.52), (0.34, 0.82), (0.66, 0.86)],
        "lines": [(0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (4, 5), (3, 6), (4, 6), (5, 7), (4, 7)],
        "bright": [0, 6, 7],
    },
    "ursa-major": {
        "stars": [(0.10, 0.30), (0.24, 0.24), (0.38, 0.32), (0.50, 0.28), (0.62, 0.40), (0.70, 0.62), (0.52, 0.66)],
        "lines": [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 3)],
        "bright": [0, 5],
    },
    "cassiopeia": {
        "stars": [(0.08, 0.55), (0.28, 0.38), (0.48, 0.52), (0.68, 0.34), (0.90, 0.50)],
        "lines": [(0, 1), (1, 2), (2, 3), (3, 4)],
        "bright": [1, 3],
    },
    "cygnus": {
        "stars": [(0.50, 0.08), (0.48, 0.34), (0.20, 0.55), (0.76, 0.52), (0.50, 0.72), (0.48, 0.94)],
        "lines": [(0, 1), (1, 2), (1, 3), (1, 4), (4, 5)],
        "bright": [0, 3],
    },
    "crux": {
        "stars": [(0.50, 0.08), (0.48, 0.86), (0.18, 0.50), (0.82, 0.54)],
        "lines": [(0, 1), (2, 3)],
        "bright": [0, 1, 2, 3],
    },
    "lyra": {
        "stars": [(0.50, 0.10), (0.34, 0.34), (0.66, 0.34), (0.40, 0.62), (0.62, 0.62), (0.52, 0.80)],
        "lines": [(0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (3, 5)],
        "bright": [0],
    },
}

SIZE = 900


def draw_constellation(name: str, spec: dict) -> None:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pad = 80
    scale = SIZE - 2 * pad
    pts = [(pad + x * scale, pad + y * scale) for x, y in spec["stars"]]

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)

    for a, b in spec["lines"]:
        gdraw.line([pts[a], pts[b]], fill=CYAN + (110,), width=7)
    for i, (x, y) in enumerate(pts):
        r = 11 if i in spec["bright"] else 6
        color = AMBER if i in spec["bright"] else WHITE
        gdraw.ellipse([x - r, y - r, x + r, y + r], fill=color + (150,))

    glow = glow.filter(ImageFilter.GaussianBlur(7))
    img = Image.alpha_composite(img, glow)

    draw = ImageDraw.Draw(img)
    for a, b in spec["lines"]:
        draw.line([pts[a], pts[b]], fill=CYAN + (210,), width=2)
    for i, (x, y) in enumerate(pts):
        r = 7 if i in spec["bright"] else 4
        color = AMBER if i in spec["bright"] else WHITE
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color + (255,))

    img.save(OUT / f"{name}.png")
    print("wrote", name)


for cname, cspec in CONSTELLATIONS.items():
    draw_constellation(cname, cspec)
print("done ->", OUT)
