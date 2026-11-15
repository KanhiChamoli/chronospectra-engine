export interface ViewportSettings {
  equatorialGrid: boolean;
  azimuthalGrid: boolean;
  atmosphere: boolean;
  constellationArt: boolean;
  constellationLines: boolean;
  constellationLabels: boolean;
  eclipticLine: boolean;
  meridianLine: boolean;
}

export const defaultViewportSettings: ViewportSettings = {
  equatorialGrid: false,
  azimuthalGrid: false,
  atmosphere: false,
  constellationArt: false,
  constellationLines: true,
  constellationLabels: true,
  eclipticLine: false,
  meridianLine: false,
};
