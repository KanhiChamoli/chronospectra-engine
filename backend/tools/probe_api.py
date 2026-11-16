"""Probe api.worldwidetelescope.org endpoints for constellation artwork images."""
import json
import urllib.request

BASE = "https://api.worldwidetelescope.org"
HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

paths = [
    "/swagger/index.html",
    "/swagger/v2/swagger.json",
    "/openapi.json",
    "/api/constellations/images",
    "/constellations/images",
    "/images",
    "/api/image?page=1&pageSize=20",
    "/image?page=1&pageSize=20",
    "/artwork",
    "/api/artwork",
    "/constellation-art",
]

for p in paths:
    url = BASE + p
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read(1500).decode("utf-8", "replace")
        print("==", resp.status, url)
        print("   ", body[:280].replace("\n", " "))
    except Exception as exc:
        print("== FAIL", url, str(exc)[:70])
