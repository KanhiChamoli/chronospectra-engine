import Link from "next/link";

const credits = [
  {
    name: "NASA/IPAC Infrared Science Archive (IRSA)",
    description: "SPHEREx archive resources, HiPS imagery, and mission data documentation.",
    url: "https://irsa.ipac.caltech.edu/Missions/spherex.html",
  },
  {
    name: "SPHEREx tutorial notebooks",
    description: "Examples for accessing SPHEREx data programmatically.",
    url: "https://caltech-ipac.github.io/irsa-tutorials/spherex/",
  },
  {
    name: "Gaia Data Release 3",
    description: "External astrometric catalog resource listed by the challenge.",
    url: "https://archive.stsci.edu/missions-and-data/gaia",
  },
  {
    name: "SIMBAD Astronomical Database",
    description: "Reference database for object names and astronomical identifiers.",
    url: "https://simbad.cds.unistra.fr/simbad/",
  },
  {
    name: "WorldWide Telescope",
    description: "Open-source WebGL engine used for the interactive sky viewport.",
    url: "https://github.com/WorldWideTelescope/wwt-webgl-engine",
  },
  {
    name: "NASA Space Apps Challenge",
    description: "Planet X and SPHEREx challenge statement and participant resources.",
    url: "https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=resources",
  },
];

export default function CreditsPage() {
  return (
    <main className="document-page">
      <Link href="/" className="document-back">← Back to the sky</Link>
      <p className="eyebrow">CHRONOSPECTRA · DATA &amp; SOFTWARE CREDITS</p>
      <h1>Credits &amp; acknowledgements</h1>
      <p>
        Chronospectra combines public astronomy resources with an original
        interface and analysis pipeline. Third-party datasets and services
        retain their own attribution, license, and usage requirements.
      </p>
      <ul className="credits-list">
        {credits.map((credit) => (
          <li key={credit.name}>
            <a href={credit.url} target="_blank" rel="noreferrer">{credit.name} ↗</a>
            <p>{credit.description}</p>
          </li>
        ))}
      </ul>
      <p className="design-credit">
        UI/UX layout inspired by the excellent open-source work of Stellarium Web.
        This project uses its own original code and does not include Stellarium
        source code or artwork.
      </p>
      <p>
        This project is MIT-licensed. NASA, NASA/IPAC, Gaia, SIMBAD, and WWT are
        credited as data or software resources; no endorsement is implied.
      </p>
    </main>
  );
}
