export interface SpectrumSample {
  wavelength_um: number;
  bandwidth_um: number;
  flux_mjy_sr: number;
  sigma_mjy_sr: number;
  flags: number;
  detector: string;
  date_obs: string;
}

export interface SpectrumResponse {
  ra_deg: number;
  dec_deg: number;
  flux_unit: string;
  wavelength_unit: string;
  available_sample_count: number;
  product_count: number;
  synthetic: boolean;
  epochs: Record<string, SpectrumSample[]>;
}

export interface Anomaly {
  target_id: string;
  target_name: string;
  synthetic: boolean;
  ra_deg: number;
  dec_deg: number;
  epoch_a: string;
  epoch_b: string;
  wavelength_um: number;
  delta_flux_mjy_sr: number;
  significance: number;
  n_matched_samples: number;
  n_sigma_threshold: number;
  narrative: string;
}

export interface AnomalyResponse {
  epoch_a: string | null;
  epoch_b: string | null;
  min_significance: number;
  count: number;
  anomalies: Anomaly[];
}

export interface DataStatusResponse {
  ready: boolean;
  product_count: number;
  target_count: number;
  epochs: string[];
  synthetic_product_count: number;
  verified_product_count: number;
}
