"""Probe Stellarium skycultures art folder naming via GitHub API tree (one shot)."""
import json
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

req = urllib.request.Request(
    "https://api.github.com/repos/Stellarium/stellarium/git/trees/master?recursive=1",
    headers=HEADERS,
)
tree = json.load(urllib.request.urlopen(req, timeout=60))
paths = [t["path"] for t in tree["tree"] if "western" in t["path"] and "skyculture" in t["path"]]
imgs = [p for p in paths if p.lower().endswith((".png", ".jpg"))]
print(len(imgs), "images under western skyculture")
for p in imgs[:60]:
    print("   ", p)
