"""Inspect the wwt-constellations repos to find where artwork images live."""
import json
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}


def gh(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    return json.load(urllib.request.urlopen(req, timeout=30))


for repo in ("wwt-constellations-frontend", "wwt-constellations-backend"):
    info = gh(f"https://api.github.com/repos/WorldWideTelescope/{repo}")
    branch = info["default_branch"]
    print("==", repo, "branch:", branch)
    tree = gh(f"https://api.github.com/repos/WorldWideTelescope/{repo}/git/trees/{branch}?recursive=1")
    paths = [t["path"] for t in tree["tree"]]
    imgs = [p for p in paths if p.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
    print("   images:", len(imgs))
    for p in imgs[:50]:
        print("    ", p)
    tops = sorted({p.split("/")[0] for p in paths})
    print("   top-level:", tops)
