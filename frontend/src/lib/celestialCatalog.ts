export interface CelestialTarget {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  raDeg: number;
  decDeg: number;
  magnitude?: string;
  distance?: string;
  spectralType?: string;
  summary: string;
  source: string;
}

function approximateSolarCoordinates(date = new Date()): { raDeg: number; decDeg: number } {
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5;
  const days = julianDate - 2_451_545;
  const meanLongitude = ((280.46 + 0.9856474 * days) % 360 + 360) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * days) * Math.PI / 180;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly)) *
    Math.PI / 180;
  const obliquity = (23.439 - 0.0000004 * days) * Math.PI / 180;
  return {
    raDeg: (Math.atan2(
      Math.cos(obliquity) * Math.sin(eclipticLongitude),
      Math.cos(eclipticLongitude),
    ) * 180 / Math.PI + 360) % 360,
    decDeg: Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) * 180 / Math.PI,
  };
}

export const celestialCatalog: CelestialTarget[] = [
  {
    id: "sun",
    name: "Sun",
    category: "Star · Solar System",
    aliases: ["Sol", "Helios"],
    ...approximateSolarCoordinates(),
    magnitude: "−26.74",
    distance: "1 AU",
    spectralType: "G2V",
    summary: "The star at the center of our Solar System. Search coordinates use a low-precision solar ephemeris; WWT's solar-system layer provides the live rendered position.",
    source: "Solar System reference",
  },
  {
    id: "vega",
    name: "Vega",
    category: "Star · Variable",
    aliases: ["Alpha Lyrae", "α Lyrae", "HR 7001", "HD 172167"],
    raDeg: 279.23473479,
    decDeg: 38.78368896,
    magnitude: "0.03",
    distance: "25.04 light-years",
    spectralType: "A0V",
    summary: "Vega is one of the brightest stars in the northern sky and a well-studied photometric reference star in the constellation Lyra.",
    source: "Bright-star reference coordinates",
  },
  {
    id: "barnards-star",
    name: "Barnard's Star",
    category: "Star · Red dwarf",
    aliases: ["Barnard's Runaway Star", "HIP 87937", "GJ 699"],
    raDeg: 269.452075,
    decDeg: 4.693391,
    magnitude: "9.5 (visual, variable)",
    distance: "5.96 light-years",
    spectralType: "M4V",
    summary: "A nearby red dwarf with exceptionally large proper motion across the sky.",
    source: "SPHEREx challenge-target reference",
  },
  {
    id: "epsilon-indi-b",
    name: "Epsilon Indi B",
    category: "Substellar system · Brown dwarfs",
    aliases: ["ε Indi Ba/Bb", "WISE J2207−5646"],
    raDeg: 331.04375,
    decDeg: -56.7825,
    magnitude: "Not available in this catalog",
    distance: "About 11.9 light-years",
    spectralType: "T1 + T6",
    summary: "A nearby brown-dwarf pair orbiting the Epsilon Indi system. Coordinates here are a search reference, not a measured SPHEREx pixel.",
    source: "SPHEREx challenge-target reference",
  },
  {
    id: "wise-0855",
    name: "WISE 0855",
    category: "Substellar object · Y dwarf",
    aliases: ["WISE J085510.83−071442.5", "WISE 0855−0714"],
    raDeg: 133.7951291667,
    decDeg: -7.2451472222,
    magnitude: "Not available in this catalog",
    distance: "About 7.4 light-years",
    spectralType: "Y dwarf",
    summary: "A very cool, nearby brown dwarf and one of the closest systems to the Sun. The listed coordinates are the challenge search position.",
    source: "SPHEREx challenge-target reference",
  },
  {
    id: "rw-aurigae",
    name: "RW Aurigae",
    category: "Young stellar system · Variable",
    aliases: ["RW Aur", "HD 30197"],
    raDeg: 76.9565,
    decDeg: 30.4014,
    magnitude: "About 10 (variable)",
    distance: "About 140 parsecs",
    spectralType: "K-type pre-main-sequence",
    summary: "A young, variable stellar system in the Taurus-Auriga star-forming region.",
    source: "SPHEREx challenge-target reference",
  },
  {
    id: "r-draconis",
    name: "R Draconis",
    category: "Star · Mira variable",
    aliases: ["R Dra"],
    raDeg: 240.35,
    decDeg: 66.7522,
    magnitude: "About 7–13 (variable)",
    distance: "Not available in this catalog",
    spectralType: "M-type",
    summary: "A pulsating Mira-type red giant in the constellation Draco.",
    source: "SPHEREx challenge-target reference",
  },
];

export function searchCelestialTargets(query: string): CelestialTarget[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return celestialCatalog
    .filter((target) =>
      [target.name, ...target.aliases, target.category]
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    )
    .slice(0, 8);
}
