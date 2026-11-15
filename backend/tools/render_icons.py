"""Render frontend/src/app/icon.svg to transparent PNGs (icon.png + apple-icon.png).

Tries cairosvg first (SVG-exact), falls back to a headless-browser render,
then a PIL-drawn approximation. Works cross-platform without Cairo DLLs by
defaulting to the browser render when available.
"""
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[2]
app_dir = root / "frontend" / "src" / "app"
svg_path = app_dir / "icon.svg"


def via_cairosvg() -> bool:
    try:
        import cairosvg
    except (ImportError, OSError):
        return False
    try:
        cairosvg.svg2png(url=str(svg_path), write_to=str(app_dir / "icon.png"), output_width=192, output_height=192)
        cairosvg.svg2png(url=str(svg_path), write_to=str(app_dir / "apple-icon.png"), output_width=180, output_height=180)
        return True
    except OSError:
        return False


def via_browser() -> bool:
    """Render with an installed headless Chromium/Edge using --screenshot on a transparent page."""
    html = (
        "<!doctype html><style>html,body{margin:0;background:transparent;}"
        f"svg{{width:192px;height:192px}}</style>{svg_path.read_text(encoding='utf-8')}"
    )
    page = Path(tempfile.gettempdir()) / "csrnasa-icon.html"
    page.write_text(html, encoding="utf-8")
    out = Path(tempfile.gettempdir()) / "csrnasa-icon.png"
    for exe in ("msedge", "chrome"):
        for prefix in (r"C:\Program Files (x86)\Microsoft\Edge\Application", r"C:\Program Files\Google\Chrome\Application"):
            binary = Path(prefix) / f"{exe}.exe"
            if not binary.is_file():
                continue
            subprocess.run(
                [
                    str(binary),
                    "--headless=new",
                    "--disable-gpu",
                    "--default-background-color=00000000",
                    f"--screenshot={out}",
                    "--window-size=192,192",
                    page.as_uri(),
                ],
                check=True,
                capture_output=True,
                timeout=60,
            )
            break
        else:
            continue
        break
    else:
        return False
    if not out.is_file():
        return False
    from PIL import Image

    Image.open(out).save(app_dir / "icon.png")
    Image.open(out).resize((180, 180), Image.LANCZOS).save(app_dir / "apple-icon.png")
    return True


if via_cairosvg():
    print("wrote icon.png and apple-icon.png via cairosvg")
elif via_browser():
    print("wrote icon.png and apple-icon.png via headless browser")
else:
    sys.exit("No SVG renderer available (install cairosvg with Cairo DLLs, or Edge/Chrome).")
