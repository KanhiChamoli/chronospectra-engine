export type ViewMode = "sky" | "cutout" | "plots";
export type CutoutMode = "blink" | "diff" | "stack";
export type StretchMode = "asinh" | "log" | "linear";
export type DetectorBand = "all" | "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
export type FoV = "1'" | "2'" | "8'" | "15'";

export interface EpochVisit {
  id: string;
  label: string; // e.g. "2025-08"
  date: string; // ISO date
  mjd: number;
  exposures: number;
  wavelengthRange: string;
  detector: DetectorBand;
}

export interface CutoutFrame {
  epoch: string;
  width: number;
  height: number;
  pixels: Float32Array; // normalized flux values
  saturatedMask?: Uint8Array;
  flagMask?: Uint8Array;
  bg: number;
  noise: number;
}

export interface GaiaSource {
  sourceId: string;
  ra: number;
  dec: number;
  pmra?: number; // mas/yr
  pmdec?: number; // mas/yr
  photGMeanMag?: number;
  parallax?: number;
}

export interface CandidateSource {
  id: string;
  ra: number;
  dec: number;
  pixelX: number;
  pixelY: number;
  tags: ("moving" | "variable" | "very-red" | "not-in-gaia")[];
  properMotion?: number; // arcsec/yr
  properMotionPA?: number; // degrees
  properMotionUncertainty?: number;
  pixelShift?: number;
  variabilitySignificance?: number;
  gaiaMatch?: boolean;
  worstOffsetArcsec?: number;
  worstOffsetPx?: number;
  perVisitOffsets?: { epoch: string; offsetArcsec: number; offsetPx: number }[];
  fluxByBand?: Record<string, number>;
  saturated?: boolean;
  note?: string;
}

export interface PhotometryPoint {
  date: string;
  mjd: number;
  detector: string; // D1-D6
  flux: number; // mJy or µJy value
  fluxUnit: "mJy" | "µJy";
  sigma: number;
  saturated: boolean;
  epoch: string;
}

export interface BinnedSpectrumPoint {
  wavelength: number; // µm
  flux: number;
  sigma: number;
  snr: number;
  detector: string;
  nSamples: number;
}

export interface RawSpectrumPoint {
  wavelength: number;
  flux: number;
  sigma: number;
  detector: string;
  saturated: boolean;
}

export interface TargetPhotometry {
  targetId: string;
  targetName: string;
  lightCurve: PhotometryPoint[];
  visits: string[];
  spectraByVisit: Record<string, { raw: RawSpectrumPoint[]; binnedR40: BinnedSpectrumPoint[] }>;
}

export interface ChallengePreset {
  id: string;
  name: string;
  shortLabel: string;
  ra: number;
  dec: number;
  description: string;
  watchFor: string;
  category: string;
  spectralClass?: string;
  knownPM?: number; // arcsec/yr
  defaultMode?: CutoutMode;
  defaultBand?: DetectorBand;
}

export interface TourStep {
  id: string;
  title: string;
  text: string;
  selector?: string;
}

export interface AsteroidMatch {
  name: string;
  designation: string;
  offsetArcsec: number;
  velocityArcsecHr: number;
  type: string;
}

export interface DiscoveryPacket {
  target: { name: string; ra: number; dec: number; id: string };
  fov: string;
  epochs: { label: string; mjd: number; date: string }[];
  gaiaCrossMatch: { worstOffsetArcsec: number; worstOffsetPx: number; matched: boolean; perVisit: { epoch: string; offsetArcsec: number; offsetPx: number }[] };
  solarSystemClearance: { clear: boolean; matches: AsteroidMatch[] };
  properMotion: { pmArcsecYr: number; pa: number; uncertainty: number } | null;
  photometry: PhotometryPoint[];
  spectrumR40: BinnedSpectrumPoint[];
  shareUrl: string;
  exportedAt: string;
}
