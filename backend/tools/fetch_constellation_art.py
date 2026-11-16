"""Download all Western constellation art drawings from Stellarium v0.22.0
(CC-BY / GPL-2+ licensed sky culture artwork) into frontend/public/constellations/."""
import re
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 Chronospectra/1.0"}
BASE = "https://cdn.jsdelivr.net/gh/Stellarium/stellarium@0.22.0/skycultures/western/"
OUT = "frontend/public/constellations"

names = ["aquila","andromeda","aries","austrinus","bootes","canes","canis","capricornus","carina","cassiopeia","centaurus","cepheus","cetus","chamaeleon","circinus","columba","coma","corona","corvus","crater","crux","cygnus","delphinus","dorado","draco","equuleus","eridanus","fornax","gemini","grus","hercules","horologium","hydra","hydrus","indus","lacerta","leo","lepus","libra","lupus","lynx","lyra","mensa","microscopium","monoceros","musca","norma","octans","ophiuchus","orion","pavo","pegasus","perseus","phoenix","pictor","pisces","piscis","puppis","pyxis","reticulum","sagitta","sagittarius","scorpius","sculptor","scutum","serpens","sextans","taurus","telescopium","triangulum","tucana","ursa","vela","virgo","volans","vulpecula","ophiuchus","norma","bootes","canes","coma","corona","canis","piscis","ursa","serpens","triangulum"]
names = sorted(set(names))
print("constellations to try:", len(names))

saved = 0
missing = []
for name in names:
    for fname in (f"{name}.png", f"{name}.jpg"):
        try:
            data = urllib.request.urlopen(
                urllib.request.Request(BASE + fname, headers=HEADERS), timeout=30
            ).read()
            ext = fname.rsplit(".", 1)[-1]
            with open(f"{OUT}/{name}.{ext}", "wb") as fh:
                fh.write(data)
            saved += 1
            break
        except Exception:
            continue
    else:
        missing.append(name)

print("saved:", saved, "| missing:", missing[:20])
