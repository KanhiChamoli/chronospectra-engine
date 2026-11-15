import type {
  CutoutFrame,
  EpochVisit,
  GaiaSource,
  CandidateSource,
  PhotometryPoint,
  BinnedSpectrumPoint,
  RawSpectrumPoint,
  TargetPhotometry,
  ChallengePreset,
  AsteroidMatch,
} from "@/types/cutout";
import { challengePresets } from "./challengePresets";

// Deterministic pseudo-random from seed
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

export const defaultEpochs: EpochVisit[] = [
  { id: "2025-08", label: "2025-08", date: "2025-08-15T00:00:00Z", mjd: 60902.0, exposures: 6, wavelengthRange: "0.75–5.00 µm", detector: "all" },
  { id: "2025-09", label: "2025-09", date: "2025-09-12T00:00:00Z", mjd: 60930.0, exposures: 8, wavelengthRange: "0.75–5.00 µm", detector: "all" },
  { id: "2026-03", label: "2026-03", date: "2026-03-20T00:00:00Z", mjd: 61119.0, exposures: 7, wavelengthRange: "0.75–5.00 µm", detector: "all" },
  { id: "2026-05", label: "2026-05", date: "2026-05-10T00:00:00Z", mjd: 61170.0, exposures: 8, wavelengthRange: "2.11–2.26 µm", detector: "all" },
  { id: "2026-08", label: "2026-08", date: "2026-08-05T00:00:00Z", mjd: 61257.0, exposures: 6, wavelengthRange: "0.75–5.00 µm", detector: "all" },
  { id: "2026-09", label: "2026-09", date: "2026-09-08T00:00:00Z", mjd: 61291.0, exposures: 8, wavelengthRange: "0.75–5.00 µm", detector: "all" },
];

const DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"];
const DET_WAVELENGTHS = [0.93, 1.25, 1.65, 2.2, 3.3, 4.5]; // center µm

function gaussian(x: number, y: number, cx: number, cy: number, sigma: number): number {
  const dx = x - cx;
  const dy = y - cy;
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

export function generateCutoutFrames(preset: ChallengePreset, fovArcmin: number = 8): { epochs: EpochVisit[]; frames: Record<string, CutoutFrame>; width: number; height: number } {
  const size = 64; // pixels
  const rand = mulberry32(hashString(preset.id));
  const epochs = defaultEpochs;
  const frames: Record<string, CutoutFrame> = {};
  const pm = preset.knownPM ?? 0.5; // arcsec/yr
  const arcsecPerPixel = (fovArcmin * 60) / size;
  const pxPerYear = pm / arcsecPerPixel;

  // Background stars (stationary)
  const bgStars: { x: number; y: number; flux: number; sigma: number }[] = [];
  for (let i = 0; i < 12; i++) {
    bgStars.push({
      x: rand() * size,
      y: rand() * size,
      flux: 0.3 + rand() * 2.5,
      sigma: 1.2 + rand() * 0.8,
    });
  }

  // Main target starts near center
  const baseX = size / 2 + (rand() - 0.5) * 4;
  const baseY = size / 2 + (rand() - 0.5) * 4;
  // Motion direction (mostly north for Barnard's, varied for others)
  const paRad = preset.id === "barnards-star" ? -Math.PI / 2 + 0.3 : rand() * Math.PI * 2;
  const refMjd = epochs[0].mjd;

  epochs.forEach((epoch, ei) => {
    const pixels = new Float32Array(size * size);
    const saturated = new Uint8Array(size * size);
    const flags = new Uint8Array(size * size);
    const dt = (epoch.mjd - refMjd) / 365.25; // years
    const tx = baseX + Math.cos(paRad) * pxPerYear * dt;
    const ty = baseY + Math.sin(paRad) * pxPerYear * dt;

    // Background noise
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = (rand() - 0.5) * 0.05;
    }

    // Stationary background stars
    bgStars.forEach((star) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          pixels[y * size + x] += star.flux * gaussian(x, y, star.x, star.y, star.sigma);
        }
      }
    });

    // Moving target
    let targetFlux = 3.0;
    if (preset.id === "rw-aur") targetFlux = 2.0 + Math.sin(ei * 1.3) * 1.5 + rand() * 0.3;
    if (preset.id === "r-dra") targetFlux = 1.5 + Math.sin(ei * 0.8 + 1) * 2.0 + rand() * 0.4;
    if (preset.id === "wise-0855") targetFlux = 0.8 + rand() * 0.2;
    if (preset.id === "epsilon-indi-b") targetFlux = 1.5 + rand() * 0.3;
    if (preset.id === "barnards-star") targetFlux = 8.0; // bright, will saturate core

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const val = targetFlux * gaussian(x, y, tx, ty, 1.8);
        pixels[y * size + x] += val;
        if (preset.id === "barnards-star" && val > 5.5) {
          saturated[y * size + x] = 1;
          pixels[y * size + x] = 5.5;
        }
      }
    }

    frames[epoch.id] = {
      epoch: epoch.id,
      width: size,
      height: size,
      pixels,
      saturatedMask: saturated,
      flagMask: flags,
      bg: 0,
      noise: 0.05,
    };
  });

  return { epochs, frames, width: size, height: size };
}

export function generatePhotometry(preset: ChallengePreset): TargetPhotometry {
  const rand = mulberry32(hashString(preset.id + "-phot"));
  const lightCurve: PhotometryPoint[] = [];
  const spectraByVisit: Record<string, { raw: RawSpectrumPoint[]; binnedR40: BinnedSpectrumPoint[] }> = {};

  // Base flux profile per detector (mJy) - depends on spectral class
  const baseFluxByDet: Record<string, number> = {
    D1: 1.0, D2: 1.2, D3: 1.5, D4: 2.0, D5: 2.5, D6: 3.0,
  };
  if (preset.id === "wise-0855" || preset.id === "epsilon-indi-b") {
    // Very red: faint in D1-D2, bright in D5-D6
    Object.assign(baseFluxByDet, { D1: 0.02, D2: 0.05, D3: 0.15, D4: 0.8, D5: 5.0, D6: 12.0 });
  }
  if (preset.id === "barnards-star") {
    Object.assign(baseFluxByDet, { D1: 15, D2: 18, D3: 20, D4: 22, D5: 18, D6: 12 });
  }
  if (preset.id === "rw-aur") {
    Object.assign(baseFluxByDet, { D1: 3, D2: 3.5, D3: 4, D4: 5, D5: 4.5, D6: 3.5 });
  }
  if (preset.id === "r-dra") {
    Object.assign(baseFluxByDet, { D1: 8, D2: 12, D3: 18, D4: 25, D5: 20, D6: 15 });
  }

  defaultEpochs.forEach((epoch, ei) => {
    DETECTORS.forEach((det) => {
      let flux = baseFluxByDet[det] * (1 + (rand() - 0.5) * 0.1);
      // Variability for RW Aur and R Dra
      if (preset.id === "rw-aur") flux *= 0.5 + Math.abs(Math.sin(ei * 1.4 + DETECTORS.indexOf(det) * 0.3)) * 1.2;
      if (preset.id === "r-dra") flux *= 0.4 + Math.abs(Math.sin(ei * 0.9 + 0.5)) * 1.5;
      const sigma = flux * (0.03 + rand() * 0.05);
      const saturated = preset.id === "barnards-star" && (det === "D3" || det === "D4") && rand() > 0.5;
      lightCurve.push({
        date: epoch.date,
        mjd: epoch.mjd,
        detector: det,
        flux: saturated ? flux * 0.7 : flux,
        fluxUnit: "mJy",
        sigma,
        saturated,
        epoch: epoch.id,
      });
    });

    // Generate spectrum for this visit
    const raw: RawSpectrumPoint[] = [];
    const binnedR40: BinnedSpectrumPoint[] = [];
    // 102 channels from 0.75 to 5.0 µm
    for (let ch = 0; ch < 102; ch++) {
      const wl = 0.75 + (ch / 101) * 4.25;
      const detIdx = wl < 1.1 ? 0 : wl < 1.6 ? 1 : wl < 2.4 ? 2 : wl < 3.1 ? 3 : wl < 4.0 ? 4 : 5;
      const det = DETECTORS[detIdx];
      let base = baseFluxByDet[det];
      // Add spectral shape
      if (preset.id === "wise-0855" || preset.id === "epsilon-indi-b") {
        base *= Math.pow(wl / 1.0, 2.5); // red slope
      }
      if (preset.id === "r-dra") base *= 0.4 + Math.abs(Math.sin(ei * 0.9 + 0.5)) * 1.5;
      if (preset.id === "rw-aur") base *= 0.5 + Math.abs(Math.sin(ei * 1.4)) * 1.2;
      // H2O absorption dip around 3.05µm
      if (wl > 2.85 && wl < 3.2) base *= 0.6 + (Math.abs(wl - 3.05) / 0.15) * 0.4;
      // CO2 absorption around 4.27µm
      if (wl > 4.15 && wl < 4.35) base *= 0.7 + (Math.abs(wl - 4.27) / 0.1) * 0.3;
      const noise = base * (0.05 + rand() * 0.15);
      const flux = Math.max(0.001, base + (rand() - 0.5) * noise);
      const sigma = base * (0.04 + rand() * 0.06);
      const saturated = preset.id === "barnards-star" && wl > 1.5 && wl < 2.5 && rand() > 0.6;
      raw.push({ wavelength: wl, flux, sigma, detector: det, saturated });
    }

    // Bin at R=40
    const binWidth = (wl: number) => wl / 40;
    let binStart = 0.75;
    while (binStart < 5.0) {
      const bw = binWidth(binStart + 0.01);
      const binEnd = binStart + bw;
      const inBin = raw.filter((r) => r.wavelength >= binStart && r.wavelength < binEnd && !r.saturated);
      if (inBin.length > 0) {
        const sumW = inBin.reduce((s, r) => s + 1 / (r.sigma * r.sigma), 0);
        const wMean = inBin.reduce((s, r) => s + r.flux / (r.sigma * r.sigma), 0) / sumW;
        const wSigma = Math.sqrt(1 / sumW);
        const avgWl = inBin.reduce((s, r) => s + r.wavelength, 0) / inBin.length;
        binnedR40.push({
          wavelength: avgWl,
          flux: wMean,
          sigma: wSigma,
          snr: wSigma > 0 ? wMean / wSigma : 0,
          detector: inBin[0].detector,
          nSamples: inBin.length,
        });
      }
      binStart = binEnd;
    }

    spectraByVisit[epoch.id] = { raw, binnedR40 };
  });

  return {
    targetId: preset.id,
    targetName: preset.name,
    lightCurve,
    visits: defaultEpochs.map((e) => e.id),
    spectraByVisit,
  };
}

export function generateGaiaSources(preset: ChallengePreset): GaiaSource[] {
  const rand = mulberry32(hashString(preset.id + "-gaia"));
  const sources: GaiaSource[] = [];
  // Main target Gaia source (if not "not in Gaia")
  if (preset.id !== "wise-0855") {
    sources.push({
      sourceId: `gaia-${preset.id}`,
      ra: preset.ra,
      dec: preset.dec,
      pmra: (preset.knownPM ?? 0.5) * 1000 * 0.7 * (preset.id === "barnards-star" ? -0.8 : 0.5),
      pmdec: (preset.knownPM ?? 0.5) * 1000 * 0.7 * (preset.id === "barnards-star" ? 0.95 : -0.3),
      photGMeanMag: preset.id === "barnards-star" ? 9.5 : 14.0 + rand() * 3,
    });
  }
  // Background Gaia stars
  for (let i = 0; i < 8; i++) {
    sources.push({
      sourceId: `gaia-bg-${preset.id}-${i}`,
      ra: preset.ra + (rand() - 0.5) * 0.15,
      dec: preset.dec + (rand() - 0.5) * 0.15,
      photGMeanMag: 12 + rand() * 6,
    });
  }
  return sources;
}

export function generateCandidates(preset: ChallengePreset): CandidateSource[] {
  const rand = mulberry32(hashString(preset.id + "-cand"));
  const candidates: CandidateSource[] = [];
  const pm = preset.knownPM ?? 0.5;

  // Main candidate
  const mainTags: CandidateSource["tags"] = [];
  if (pm > 1) mainTags.push("moving");
  if (preset.id === "rw-aur" || preset.id === "r-dra") mainTags.push("variable");
  if (preset.id === "wise-0855" || preset.id === "epsilon-indi-b") mainTags.push("very-red");
  if (preset.id === "wise-0855") mainTags.push("not-in-gaia");

  candidates.push({
    id: `cand-main-${preset.id}`,
    ra: preset.ra,
    dec: preset.dec,
    pixelX: 32,
    pixelY: 32,
    tags: mainTags,
    properMotion: pm,
    properMotionPA: preset.id === "barnards-star" ? 355.8 : Math.round(rand() * 360),
    properMotionUncertainty: pm * 0.08 + 0.02,
    pixelShift: pm * (389 / 365.25) / 7.5, // ~13 months baseline, 7.5"/px at 8'
    variabilitySignificance: preset.id === "rw-aur" ? 12.4 : preset.id === "r-dra" ? 18.7 : 1.2,
    gaiaMatch: preset.id !== "wise-0855",
    worstOffsetArcsec: preset.id === "wise-0855" ? undefined : 0.3 + rand() * 0.6,
    worstOffsetPx: preset.id === "wise-0855" ? undefined : 0.04 + rand() * 0.08,
    perVisitOffsets: preset.id === "wise-0855" ? [] : defaultEpochs.slice(0, 5).map((e) => ({
      epoch: e.id,
      offsetArcsec: 0.2 + rand() * 0.8,
      offsetPx: 0.03 + rand() * 0.1,
    })),
    saturated: preset.id === "barnards-star",
    note: preset.watchFor,
  });

  // Additional field candidates
  for (let i = 0; i < 8; i++) {
    const tags: CandidateSource["tags"] = [];
    const isRed = rand() > 0.85;
    const isVar = rand() > 0.8;
    const isNotGaia = rand() > 0.9;
    if (isRed) tags.push("very-red");
    if (isVar) tags.push("variable");
    if (isNotGaia) tags.push("not-in-gaia");
    if (tags.length === 0) continue;
    candidates.push({
      id: `cand-field-${preset.id}-${i}`,
      ra: preset.ra + (rand() - 0.5) * 0.12,
      dec: preset.dec + (rand() - 0.5) * 0.12,
      pixelX: Math.floor(rand() * 60) + 2,
      pixelY: Math.floor(rand() * 60) + 2,
      tags,
      variabilitySignificance: isVar ? 5 + rand() * 10 : undefined,
      gaiaMatch: !isNotGaia,
    });
  }
  return candidates;
}

export function generateAsteroidMatches(preset: ChallengePreset): AsteroidMatch[] {
  const rand = mulberry32(hashString(preset.id + "-ast"));
  if (rand() > 0.4) return []; // Most fields clear
  return [{
    name: "(433) Eros",
    designation: "433",
    offsetArcsec: 0.8 + rand() * 2.0,
    velocityArcsecHr: 20 + rand() * 30,
    type: "Near-Earth Asteroid",
  }];
}

export const defaultCommunityFinds = [
  {
    id: "cs-01",
    name: "Candidate CS-01: High-PM White Dwarf",
    description: "High proper motion white dwarf candidate with 4.2\"/yr motion, clear Gaia match, detected across D1–D3.",
    ra: 187.5, dec: 12.3, tags: ["Moving"], sigma: 8.1,
  },
  {
    id: "cs-02",
    name: "Candidate CS-02: Ultra-Red D5–D6 Not in Gaia",
    description: "Extremely red source bright in D5–D6, absent in D1–D2, no Gaia counterpart within 2.5\". Brown dwarf candidate.",
    ra: 95.2, dec: -33.1, tags: ["Very Red", "Not in Gaia"], sigma: 6.7,
  },
  {
    id: "cs-03",
    name: "Candidate CS-03: Ecliptic Shift-Stack 6.4σ Residual",
    description: "Faint residual at 6.4σ emerges in shift-stack at µ=1.2\"/yr, PA=135°. Potential distant solar system object.",
    ra: 210.8, dec: -8.5, tags: ["Moving", "Not in Gaia"], sigma: 6.4,
  },
  {
    id: "cs-04",
    name: "Candidate CS-04: Known KBO Control Check",
    description: "Known Kuiper Belt Object recovered by shift-stack pipeline. Validates detection methodology.",
    ra: 45.6, dec: 18.9, tags: ["Moving"], sigma: 5.2,
  },
];
