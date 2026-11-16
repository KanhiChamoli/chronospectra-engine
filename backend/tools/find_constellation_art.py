"""Find the wtml catalog the WWT web client uses for constellation figures/art.

The engine loads its "Sky" data from a WTML manifest; search the wwt-web-client
source for the manifest URL, then fetch it and look for art/folklore entries.
"""
import json
import re
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

# Fetch engine HTML entry — it passes a WTML to load
html = urllib.request.urlopen(
    urllib.request.Request("https://www.worldwidetelescope.org/webclient/", headers=HEADERS),
    timeout=25,
).read().decode("utf-8", "replace")

wtml = sorted(set(re.findall(r'https?://[^"\'<>\s]+\.wtml[^"\'<>\s]*', html, re.I)))
print("wtml refs on defaultAas:", wtml[:10])

# Also fetch the client JS bundle which hardcodes data
page = html
scripts = re.findall(r'src="([^"]+\.js[^"]*)"', page)
print(len(scripts), "scripts")
found = set()
for src in scripts[:8]:
    u = src if src.startswith("http") else "https://www.worldwidetelescope.org" + src
    try:
        js = urllib.request.urlopen(urllib.request.Request(u, headers=HEADERS), timeout=40).read().decode("utf-8", "replace")
        found.update(re.findall(r'https?://[^"\']+\.(?:wtml|txt)[^"\']*', js, re.I))
        found.update(h for h in re.findall(r'https?://[^"\']+', js) if "constell" in h.lower() and ("art" in h.lower() or "folk" in h.lower()))
    except Exception as exc:
        print("bundle fail", str(exc)[:50])
print("candidate data urls:")
for u in sorted(found)[:30]:
    print("   ", u)
