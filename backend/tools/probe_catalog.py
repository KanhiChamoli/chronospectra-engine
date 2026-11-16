"""Fetch WWT desktop client data pack - the constellation art lives in the 'ConstellationArt' folder of data2."""
import re
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

candidates = [
    # data2 CDN used by WWT client for its imagery packs:
    "https://data2.worldwidetelescope.org/wwtweb/catalog.aspx?Q=constellationart",
    "https://data1.worldwidetelescope.org/wwtweb/catalog.aspx?Q=constellationart",
    # Historic desktop pack URL patterns:
    "https://www.worldwidetelescope.org/wwtweb/catalog.aspx?Q=folder&name=ConstellationArt",
    "https://www.worldwidetelescope.org/wwtweb/catalog.aspx?Q=name&name=ConstellationArt&format=xml",
    # The web client's own engine data — constellations art in 'figures' at engine-assets:
    "https://www.worldwidetelescope.org/engineassets/art.txt",
    "https://www.worldwidetelescope.org/wwtweb/thumbnails.aspx?O=constellationart",
]

for url in candidates:
    try:
        text = urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20).read().decode("utf-8", "replace")
        urls = sorted(set(re.findall(r"https?://[^\"'<>\s]+", text)))
        arts = [u for u in urls if re.search(r"\.(png|jpg|jpeg)", u, re.I)]
        print("==", url.split("?")[-1][:50], len(text), "bytes,", len(arts), "image urls")
        for u in arts[:20]:
            print("   ", u[:150])
        if not arts:
            print("    ", text[:200].replace("\n", " "))
    except Exception as exc:
        print("== FAIL", str(exc)[:60], url[:80])
