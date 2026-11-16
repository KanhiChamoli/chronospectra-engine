"""Generate stylized all-sky comparison images for the landing slider.

gaia-visible.jpg  - pale-blue/white point-source Milky Way band (visible light feel)
spherex-infrared.jpg - warm amber/red diffuse band (infrared feel)
Both are procedurally drawn all-sky Aitoff-style maps with a central
Milky Way band plus Magellanic Cloud smudges - schematic, not pixel data.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "sky"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1600, 800


def aitoff_x(l: float) -> float:
    return (l if l <= 180 else l - 360) / 180.0


def draw_band(draw: ImageDraw.Draw, color_fn, band_center_y: float = 0.5, spread: float = 0.16, blobs: int = 260, seed: int = 7) -> None:
    import random

    rng = random.Random(seed)
    for _ in range(blobs):
        lon = rng.uniform(0, 360)
        # denser toward galactic equator with clumps
        lat = rng.gauss(0, spread * (0.6 + 0.8 * abs(math.sin(math.radians(lon * 2)))))
        x = W * (0.5 + aitoff_x(lon) * 0.48)
        y = H * (band_center_y - lat * 0.9)
        r = rng.uniform(4, 26)
        alpha = rng.randint(20, 70)
        draw.ellipse([x - r, y - r * 0.45, x + r, y + r * 0.45], fill=color_fn(alpha))


def make(filename: str, band_color, core_color, star_color, n_stars: int, seed: int) -> None:
    img = Image.new("RGB", (W, H), (5, 7, 14))
    draw = ImageDraw.Draw(img)

    # faint grid: galactic lon every 30deg
    for lon in range(0, 360, 30):
        x = W * (0.5 + aitoff_x(lon) * 0.48)
        draw.line([x, 0, x, H], fill=(25, 32, 46), width=1)
    for lat in range(-60, 61, 30):
        y = H * (0.5 - lat / 180)
        draw.line([0, y, W, y], fill=(25, 32, 46), width=1)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    draw_band(ldraw, band_color, blobs=340, seed=seed)
    draw_band(ldraw, core_color, spread=0.06, blobs=170, seed=seed + 1)
    layer = layer.filter(ImageFilter.GaussianBlur(9))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

    draw = ImageDraw.Draw(img)
    import random

    rng = random.Random(seed + 2)
    for _ in range(n_stars):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.choice([0.7, 1.0, 1.4, 2.0])
        draw.ellipse([x - r, y - r, x + r, y + r], fill=star_color)

    # Magellanic cloud smudges
    for cx, cy, r in ((W * 0.82, H * 0.72, 34), (W * 0.86, H * 0.62, 22)):
        draw.ellipse([cx - r, cy - r * 0.7, cx + r, cy + r * 0.7], fill=band_color(90))

    img.save(OUT / filename, quality=88)
    print("wrote", filename)


make(
    "gaia-visible.jpg",
    lambda a: (150, 170, 210, a),
    lambda a: (215, 226, 245, a),
    (235, 240, 250),
    2600,
    seed=11,
)
make(
    "spherex-infrared.jpg",
    lambda a: (190, 120, 60, a),
    lambda a: (255, 190, 110, a),
    (255, 205, 140),
    1200,
    seed=23,
)
print("done ->", OUT)
