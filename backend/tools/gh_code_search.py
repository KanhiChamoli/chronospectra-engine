"""Search GitHub org repos for sky-culture artwork (WWT Constellations project data)."""
import json
import re
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}

# GitHub code search API works unauthenticated at low volume via /search/code?q=...+in:file
for q in [
    "constellation+art+org:WorldWideTelescope",
    "folklore+imageset",
    "art_aquila",
    "constellation+art+in:file+language:python",
]:
    url = f"https://api.github.com/search/code?q={q.replace(' ', '+')}"
    try:
        data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20))
        print("==", q, "->", data.get("total_count"), "results")
        for item in data.get("items", [])[:8]:
            print("   ", item["repository"]["full_name"], item["path"])
    except Exception as exc:
        print("==", q, "FAIL", str(exc)[:100])
