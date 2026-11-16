"""Search GitHub HTML (no-API fallback) for WWT folk-art WTML/image references."""
import re
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

# GitHub HTML search (may work without auth for a few hits)
queries = [
    "https://github.com/search?q=org%3AWorldWideTelescope+folklore+art&type=code",
    "https://github.com/search?q=%22ConstellationArt%22+org%3AWorldWideTelescope&type=code",
]

for u in queries:
    try:
        text = urllib.request.urlopen(urllib.request.Request(u, headers=HEADERS), timeout=25).read().decode("utf-8", "replace")
        # results are embedded in JSON payload
        paths = sorted(set(re.findall(r'"path":"([^"]+)"', text)))[:30]
        repos = sorted(set(re.findall(r'"repository":\{"raw":\{"name":"([^"]+)"', text)))
        print("==", u.split("q=")[1][:40], "paths:", paths[:12])
        print("   repos:", repos[:8])
    except Exception as exc:
        print("== FAIL", str(exc)[:60], u[:70])
