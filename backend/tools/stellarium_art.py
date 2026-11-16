"""Check Sky & Telescope / Stellarium open-source constellation art (openly licensed,
hot-linkable) and validate Stellarium's skyculture drawing PNGs as the artwork source."""
import json
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

# Stellarium hosts Western constellation art under GitHub stellarium/skycultures.
# Use jsdelivr (no rate limit) to list files for the western skyculture dir.
for dirpath in (
    "skycultures/western/art",
    "skycultures/western",
):
    url = f"https://data.jsdelivr.com/v1/packages/gh/Stellarium/stellarium@master/{dirpath}"
    try:
        data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40))
        files = [f["name"] for f in data.get("files", [])]
        print(dirpath, "->", len(files), "entries")
        for f in files[:60]:
            print("   ", f)
    except Exception as exc:
        print(dirpath, "FAIL", str(exc)[:80])
