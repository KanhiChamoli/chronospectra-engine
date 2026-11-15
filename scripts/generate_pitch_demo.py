"""Render Chronospectra's 30-second pitch-deck demo video.

Install the optional tools with ``pip install -r requirements-video.txt``, then
pass a local copy of the CC0 ambient track credited on ``/credits`` using
``--music``. The fixed narration text below is sent to Microsoft Edge TTS for
en-GB speech synthesis.
"""

from __future__ import annotations

import argparse
import asyncio
import math
import subprocess
import tempfile
import textwrap
from pathlib import Path
from typing import Any

import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1280
HEIGHT = 720
FPS = 24
DURATION_SECONDS = 30
NARRATION = (
    "Every sky tells a story across time and light. "
    "Search a target, fly to its coordinates, and explore epochs beside infrared wavelengths. "
    "Open a spectrum to compare samples; follow anomaly candidates back to the sky. "
    "Today's catalogue is synthetic demo data, not verified SPHEREx Quick Release Three observations. "
    "The workflow is ready for verified products."
)
VOICE = "en-GB-RyanNeural"
ACCENT = (81, 219, 246, 255)
BLUE = (83, 148, 255, 255)
GOLD = (255, 202, 111, 255)
MUTED = (154, 179, 205, 255)
WHITE = (235, 246, 255, 255)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = FONT_BOLD if bold else FONT_REGULAR
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def rounded(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    radius: int = 18,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    size: int,
    fill: tuple[int, int, int, int] = WHITE,
    bold: bool = False,
    anchor: str | None = None,
) -> None:
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def build_background() -> tuple[Image.Image, list[tuple[int, int, int, float]]]:
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    for y in range(HEIGHT):
        blend = y / HEIGHT
        color = (
            int(4 + 5 * blend),
            int(10 + 15 * blend),
            int(25 + 27 * blend),
            255,
        )
        draw.line((0, y, WIDTH, y), fill=color)

    seed = 2026
    stars: list[tuple[int, int, int, float]] = []
    for _ in range(90):
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
        x = seed % WIDTH
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
        y = seed % HEIGHT
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
        radius = 1 + seed % 2
        phase = (seed % 628) / 100
        stars.append((x, y, radius, phase))
    return image, stars


def draw_header(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    rounded(draw, (48, 28, 1232, 102), (9, 22, 43, 232), (57, 113, 150, 180), 18)
    cx, cy = 82, 65
    draw.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), outline=ACCENT, width=2)
    draw.arc((cx - 23, cy - 10, cx + 23, cy + 10), start=190, end=350, fill=BLUE, width=2)
    x = cx + 18 * math.cos(seconds * 0.8)
    y = cy + 9 * math.sin(seconds * 0.8)
    draw.ellipse((int(x - 3), int(y - 3), int(x + 3), int(y + 3)), fill=GOLD)
    text(draw, (116, 46), "CHRONOSPECTRA", 24, WHITE, True)
    text(draw, (117, 73), "TIME × WAVELENGTH OBSERVATORY", 11, MUTED, True)
    rounded(draw, (1030, 47, 1207, 82), (79, 45, 28, 255), (196, 128, 62, 255), 17)
    text(draw, (1118, 64), "SYNTHETIC DEMO", 13, GOLD, True, "mm")


def draw_panel(draw: ImageDraw.ImageDraw, title: str, subtitle: str = "") -> None:
    rounded(draw, (48, 122, 1232, 623), (8, 19, 38, 238), (43, 84, 121, 190), 22)
    text(draw, (82, 150), title, 23, WHITE, True)
    if subtitle:
        text(draw, (83, 183), subtitle, 14, MUTED)


def draw_intro(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    draw_panel(draw, "A changing sky, in time and light")
    text(draw, (104, 264), "Explore the sky", 58, WHITE, True)
    text(draw, (105, 334), "across epochs and infrared wavelengths.", 30, ACCENT)
    text(draw, (106, 405), "Search · compare · investigate", 20, MUTED)
    rounded(draw, (104, 485, 388, 535), (17, 47, 70, 255), (69, 150, 180, 255), 24)
    text(draw, (246, 510), "AN INTERACTIVE OBSERVATORY", 14, ACCENT, True, "mm")
    for index in range(5):
        x = 756 + index * 75
        y = 390 + math.sin(seconds * 1.5 + index) * 28
        radius = 4 + index % 2
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=ACCENT)
        draw.ellipse((x - 18, y - 18, x + 18, y + 18), outline=(81, 219, 246, 85), width=1)
    draw.arc((760, 278, 1120, 520), start=195, end=335, fill=(79, 153, 217, 180), width=2)
    draw.arc((775, 280, 1100, 535), start=15, end=155, fill=(69, 117, 168, 160), width=2)


def draw_search(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    draw_panel(draw, "Find a target and fly to its coordinates", "Shared RA/Dec links can open directly on a sky position.")
    rounded(draw, (91, 220, 608, 283), (16, 33, 56, 255), (61, 110, 150, 255), 17)
    draw.ellipse((116, 239, 138, 261), outline=ACCENT, width=2)
    draw.line((134, 258, 145, 269), fill=ACCENT, width=2)
    text(draw, (163, 235), "WISE 0855", 21, WHITE, True)
    text(draw, (164, 262), "08h55m10.831s  ·  −07°14′42.53″", 14, MUTED)
    rounded(draw, (91, 319, 604, 492), (11, 25, 45, 255), (39, 82, 115, 255), 18)
    text(draw, (121, 344), "TARGET DETAILS", 13, ACCENT, True)
    text(draw, (121, 382), "WISE 0855", 30, WHITE, True)
    text(draw, (121, 428), "Coordinate deep-link ready", 17, MUTED)
    map_box = (650, 214, 1188, 520)
    rounded(draw, map_box, (5, 15, 32, 255), (51, 101, 138, 255), 18)
    for row in range(1, 5):
        y = map_box[1] + row * 50
        draw.line((map_box[0] + 20, y, map_box[2] - 20, y), fill=(31, 57, 82, 200), width=1)
    for col in range(1, 6):
        x = map_box[0] + col * 75
        draw.line((x, map_box[1] + 20, x, map_box[3] - 20), fill=(31, 57, 82, 200), width=1)
    for i in range(32):
        x = map_box[0] + 25 + (i * 73) % 475
        y = map_box[1] + 24 + (i * 47) % 250
        radius = 1 + i % 2
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(146, 193, 230, 220))
    pulse = 14 + int(5 * math.sin(seconds * 6))
    px, py = 921, 366
    draw.ellipse((px - pulse * 2, py - pulse * 2, px + pulse * 2, py + pulse * 2), outline=(255, 202, 111, 120), width=2)
    draw.ellipse((px - pulse, py - pulse, px + pulse, py + pulse), outline=GOLD, width=2)
    draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill=GOLD)
    text(draw, (944, 371), "target", 13, GOLD, True)


def draw_matrix(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    draw_panel(draw, "One controller for time and wavelength", "Horizontal: observing epochs  ·  Vertical: infrared channels")
    rounded(draw, (1010, 143, 1196, 178), (79, 45, 28, 255), (196, 128, 62, 255), 17)
    text(draw, (1103, 160), "SYNTHETIC SAMPLES", 12, GOLD, True, "mm")
    x0, y0 = 286, 237
    cell_w, cell_h = 442, 48
    epochs = ("2025-03", "2025-09")
    wavelengths = ("0.75 µm", "1.65 µm", "2.80 µm", "3.00 µm", "4.27 µm", "5.00 µm")
    text(draw, (117, 207), "WAVELENGTH ↓", 12, ACCENT, True)
    text(draw, (555, 208), "OBSERVATION EPOCH →", 12, ACCENT, True)
    for col, epoch in enumerate(epochs):
        text(draw, (x0 + col * cell_w + 12, y0 - 20), epoch, 15, WHITE, True)
    focus_row = int((seconds * 0.9) % len(wavelengths))
    focus_col = int((seconds * 0.5) % len(epochs))
    for row, wavelength in enumerate(wavelengths):
        y = y0 + row * cell_h
        text(draw, (139, y + 12), wavelength, 16, MUTED)
        for col in range(len(epochs)):
            x = x0 + col * cell_w
            active = row == focus_row and col == focus_col
            fill = (18, 67, 87, 255) if active else (13, 30, 51, 255)
            outline = ACCENT if active else (37, 69, 96, 255)
            rounded(draw, (x, y, x + cell_w - 12, y + cell_h - 7), fill, outline, 10, 2 if active else 1)
            bar_width = 43 + ((row * 23 + col * 31) % 105)
            draw.rounded_rectangle((x + 17, y + 14, x + 17 + bar_width, y + 23), radius=5, fill=ACCENT if active else BLUE)
            text(draw, (x + 18, y + 29), "demo sample", 10, MUTED)
    text(draw, (168, 560), "Select a cell to inspect a channel; compare epochs where coverage exists.", 16, WHITE)


def draw_spectrum(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    draw_panel(draw, "Compare available pixel spectra", "Illustrative synthetic samples  ·  not QR3 observations")
    rounded(draw, (891, 143, 1196, 178), (79, 45, 28, 255), (196, 128, 62, 255), 17)
    text(draw, (1043, 160), "DEMO SPECTRUM", 12, GOLD, True, "mm")
    left, top, right, bottom = 132, 235, 1154, 514
    for step in range(5):
        y = top + step * (bottom - top) // 4
        draw.line((left, y, right, y), fill=(31, 57, 82, 255), width=1)
        text(draw, (left - 30, y), f"{1.0 - step * 0.15:.2f}", 11, MUTED, anchor="rm")
    for step, tick in enumerate(("0.75", "1.8", "2.8", "3.9", "5.0")):
        x = left + step * (right - left) // 4
        draw.line((x, top, x, bottom), fill=(25, 49, 73, 255), width=1)
        text(draw, (x, bottom + 12), tick, 12, MUTED, anchor="ma")
    text(draw, (left, 205), "NORMALISED FLUX", 12, MUTED, True)
    text(draw, (right, bottom + 35), "WAVELENGTH (µm)", 12, MUTED, True, "ra")
    for color, phase in ((ACCENT, 0.0), (GOLD, 0.7)):
        points: list[tuple[int, int]] = []
        for index in range(140):
            x = left + index * (right - left) // 139
            wave = index / 139
            signal = 0.48 + 0.19 * math.sin(wave * 15 + phase + seconds * 0.4)
            signal += 0.09 * math.sin(wave * 37 + phase)
            signal -= 0.18 * math.exp(-((wave - 0.64 - phase * 0.02) / 0.035) ** 2)
            y = bottom - int(signal * (bottom - top))
            points.append((x, y))
        draw.line(points, fill=color, width=3, joint="curve")
    text(draw, (157, 553), "—  Epoch A (synthetic)", 14, ACCENT, True)
    text(draw, (401, 553), "—  Epoch B (synthetic)", 14, GOLD, True)


def draw_anomalies(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    draw_panel(draw, "Follow candidate changes back to the sky", "Variance-based screening aids review; candidate pins are not discoveries.")
    map_box = (88, 225, 797, 536)
    rounded(draw, map_box, (5, 15, 32, 255), (51, 101, 138, 255), 18)
    for row in range(1, 5):
        y = map_box[1] + row * 55
        draw.line((map_box[0] + 22, y, map_box[2] - 22, y), fill=(31, 57, 82, 200), width=1)
    for col in range(1, 8):
        x = map_box[0] + col * 80
        draw.line((x, map_box[1] + 20, x, map_box[3] - 20), fill=(31, 57, 82, 200), width=1)
    for i in range(55):
        x = map_box[0] + 20 + (i * 67) % 664
        y = map_box[1] + 16 + (i * 43) % 278
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(150, 192, 221, 210))
    for index, (px, py, name) in enumerate(((322, 350, "candidate A"), (578, 430, "candidate B"))):
        radius = 10 + int(4 * math.sin(seconds * 5 + index))
        draw.ellipse((px - radius * 2, py - radius * 2, px + radius * 2, py + radius * 2), outline=(255, 202, 111, 90), width=2)
        draw.ellipse((px - radius, py - radius, px + radius, py + radius), outline=GOLD, width=2)
        draw.ellipse((px - 4, py - 4, px + 4, py + 4), fill=GOLD)
        text(draw, (px + 17, py - 9), name, 12, GOLD, True)
    rounded(draw, (842, 230, 1184, 529), (12, 28, 49, 255), (43, 84, 121, 255), 17)
    text(draw, (873, 259), "ANOMALY RADAR", 14, ACCENT, True)
    text(draw, (873, 306), "Compare epochs", 21, WHITE, True)
    text(draw, (873, 343), "Review candidate locations", 15, MUTED)
    text(draw, (873, 390), "Open the supporting spectrum", 15, MUTED)
    rounded(draw, (870, 441, 1153, 488), (79, 45, 28, 255), (196, 128, 62, 255), 14)
    text(draw, (1012, 464), "SYNTHETIC EXAMPLES ONLY", 12, GOLD, True, "mm")


def draw_provenance(draw: ImageDraw.ImageDraw, seconds: float) -> None:
    draw_panel(draw, "A release-ready workflow—with honest provenance", "Built to ingest and validate verified SPHEREx products when archive access allows.")
    labels = (("IRSA SIA2", "archive query"), ("FITS + flags", "product provenance"), ("Zarr / HiPS", "spectra / display"), ("Chronospectra", "map + matrix"))
    x0 = 91
    for index, (title, subtitle) in enumerate(labels):
        x = x0 + index * 283
        rounded(draw, (x, 234, x + 227, 324), (11, 31, 51, 255), (53, 117, 154, 255), 16)
        text(draw, (x + 113, 263), title, 18, ACCENT, True, "mm")
        text(draw, (x + 113, 297), subtitle, 13, MUTED, anchor="mm")
        if index < len(labels) - 1:
            text(draw, (x + 247, 278), "→", 25, GOLD, True, "mm")
    rounded(draw, (87, 377, 1190, 507), (65, 36, 26, 255), (204, 132, 59, 255), 18, 2)
    text(draw, (119, 405), "LIVE DATA STATUS", 13, GOLD, True)
    text(draw, (119, 443), "0 verified QR3 products staged", 27, WHITE, True)
    text(draw, (119, 480), "1,020 synthetic demo products  ·  not NASA observations", 17, GOLD, True)
    text(draw, (89, 551), "DR1 HiPS is a visualization layer; it is not QR3 science data.", 16, MUTED)
    text(draw, (1190, 551), "READY FOR VERIFIED RELEASES", 12, ACCENT, True, "ra")


def caption_text(captions: list[dict[str, Any]], seconds: float) -> str:
    for caption in captions:
        if caption["start"] <= seconds <= caption["end"]:
            return str(caption["text"])
    return ""


def render_frame(
    frame: int,
    background: Image.Image,
    stars: list[tuple[int, int, int, float]],
    captions: list[dict[str, Any]],
) -> bytes:
    seconds = frame / FPS
    image = background.copy()
    draw = ImageDraw.Draw(image, "RGBA")
    for x, y, radius, phase in stars:
        twinkle = 0.45 + 0.55 * abs(math.sin(seconds * 1.1 + phase))
        alpha = int(95 + twinkle * 150)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(166, 209, 242, alpha))
    draw_header(draw, seconds)

    if seconds < 3.2:
        draw_intro(draw, seconds)
    elif seconds < 8.3:
        draw_search(draw, seconds)
    elif seconds < 14.2:
        draw_matrix(draw, seconds)
    elif seconds < 19.5:
        draw_spectrum(draw, seconds)
    elif seconds < 24.0:
        draw_anomalies(draw, seconds)
    else:
        draw_provenance(draw, seconds)

    current_caption = caption_text(captions, seconds)
    rounded(draw, (48, 632, 1232, 704), (1, 6, 16, 238), (36, 74, 103, 210), 14)
    lines = textwrap.wrap(current_caption, width=88)[:2]
    for index, line in enumerate(lines):
        text(draw, (640, 656 + index * 25), line, 18, WHITE, anchor="mm")
    return image.convert("RGB").tobytes()


def timestamp(seconds: float) -> str:
    milliseconds = max(0, int(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}.{milliseconds:03}"


async def make_narration(output: Path) -> list[dict[str, Any]]:
    captions: list[dict[str, Any]] = []
    with output.open("wb") as audio_file:
        communicate = edge_tts.Communicate(
            NARRATION,
            voice=VOICE,
            rate="-6%",
            pitch="-1Hz",
            boundary="SentenceBoundary",
        )
        async for message in communicate.stream():
            if message["type"] == "audio":
                audio_file.write(message["data"])
            elif message["type"] == "SentenceBoundary":
                start = message["offset"] / 10_000_000
                end = start + message["duration"] / 10_000_000
                captions.append(
                    {"start": start, "end": min(end, DURATION_SECONDS), "text": message["text"]}
                )
    if not captions:
        raise RuntimeError("British-English TTS returned no subtitle timing metadata.")
    for index in range(len(captions) - 1):
        captions[index]["end"] = min(captions[index]["end"], captions[index + 1]["start"])
    return captions


def write_captions(path: Path, captions: list[dict[str, Any]]) -> None:
    blocks = ["WEBVTT", ""]
    for caption in captions:
        blocks.extend(
            (
                f"{timestamp(caption['start'])} --> {timestamp(caption['end'])}",
                str(caption["text"]),
                "",
            )
        )
    path.write_text("\n".join(blocks), encoding="utf-8")


def encode_video(output: Path, narration: Path, music: Path, captions: list[dict[str, Any]]) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    filter_graph = (
        "[1:a]apad=pad_dur=3[voice];"
        "[2:a]volume=0.16,afade=t=in:st=0:d=1,afade=t=out:st=27:d=3[music];"
        "[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[a]"
    )
    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "pipe:0",
        "-i",
        str(narration),
        "-stream_loop",
        "-1",
        "-i",
        str(music),
        "-filter_complex",
        filter_graph,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-t",
        str(DURATION_SECONDS),
        "-movflags",
        "+faststart",
        "-metadata",
        "title=Chronospectra 30-second demo",
        "-metadata",
        "comment=Includes CC0 ambient music and synthetic demonstration graphics.",
        str(output),
    ]
    background, stars = build_background()
    log_path = output.with_suffix(".ffmpeg.log")
    with log_path.open("wb") as log_file:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log_file)
        if process.stdin is None:
            process.terminate()
            raise RuntimeError("FFmpeg did not expose a frame-input pipe.")
        try:
            for frame in range(FPS * DURATION_SECONDS):
                process.stdin.write(render_frame(frame, background, stars, captions))
        except BrokenPipeError:
            pass
        finally:
            process.stdin.close()
        result = process.wait()
    if result != 0:
        detail = log_path.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg failed with exit code {result}: {detail[-3000:]}")
    log_path.unlink(missing_ok=True)


def create_poster(video: Path, poster: Path) -> None:
    subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            "1.5",
            "-i",
            str(video),
            "-frames:v",
            "1",
            str(poster),
        ],
        check=True,
    )


async def generate(music: Path, output: Path, captions_path: Path, poster: Path) -> None:
    if not music.is_file():
        raise FileNotFoundError(f"Ambient music file does not exist: {music}")
    output.parent.mkdir(parents=True, exist_ok=True)
    captions_path.parent.mkdir(parents=True, exist_ok=True)
    poster.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="chronospectra-demo-") as temporary:
        narration = Path(temporary) / "narration-en-gb.mp3"
        captions = await make_narration(narration)
        write_captions(captions_path, captions)
        encode_video(output, narration, music, captions)
        create_poster(output, poster)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--music", required=True, type=Path, help="Local copy of a cleared ambient track.")
    parser.add_argument("--output", type=Path, default=PUBLIC / "chronospectra-demo.mp4")
    parser.add_argument("--captions", type=Path, default=PUBLIC / "chronospectra-demo.en.vtt")
    parser.add_argument("--poster", type=Path, default=PUBLIC / "chronospectra-demo-poster.png")
    arguments = parser.parse_args()
    asyncio.run(generate(arguments.music, arguments.output, arguments.captions, arguments.poster))
    print(f"Video: {arguments.output}")
    print(f"Captions: {arguments.captions}")
    print(f"Poster: {arguments.poster}")


if __name__ == "__main__":
    main()
