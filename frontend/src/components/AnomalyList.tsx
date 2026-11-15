"use client";

import type { Anomaly } from "@/types/spectroscopy";

interface AnomalyListProps {
  anomalies: Anomaly[];
  dataReady: boolean | null;
  loading: boolean;
  error: string | null;
  onSelect: (anomaly: Anomaly) => void;
}

export function AnomalyList({
  anomalies,
  dataReady,
  loading,
  error,
  onSelect,
}: AnomalyListProps) {
  return (
    <section className="anomaly-panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">AUTOMATED DIFFERENTIAL SCAN</p>
          <h2>Anomaly radar</h2>
        </div>
        <span className="radar-dot" aria-hidden="true" />
      </div>
      {loading && <p className="muted-message">Scanning available epoch products…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && dataReady === false && (
        <p className="muted-message">Stage QR3 Zarr products to enable epoch scanning.</p>
      )}
      {!loading && !error && dataReady !== false && !anomalies.length && (
        <p className="muted-message">No candidate shifts meet the current threshold.</p>
      )}
      <ul className="anomaly-list">
        {anomalies.map((anomaly) => (
          <li key={`${anomaly.target_id}-${anomaly.epoch_a}-${anomaly.epoch_b}`}>
            <button type="button" className="anomaly-row" onClick={() => onSelect(anomaly)}>
              <span className="anomaly-row-top">
                <span className="anomaly-name"><i className="radar-dot small" />{anomaly.target_name}</span>
                <span className="anomaly-stat">
                  {anomaly.synthetic && <small>SYNTHETIC</small>}
                  <strong>{Math.abs(anomaly.significance).toFixed(1)}σ</strong>
                </span>
              </span>
              <span className="anomaly-meta">
                {anomaly.wavelength_um.toFixed(3)} μm · {anomaly.epoch_a} → {anomaly.epoch_b}
              </span>
              <span className="anomaly-story">{anomaly.narrative}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="radar-caveat">
        Screening candidates only. Variance-based sigma is not a discovery claim; inspect flags and images.
      </p>
    </section>
  );
}
