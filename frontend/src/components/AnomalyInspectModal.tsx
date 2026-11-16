"use client";
import { X } from "lucide-react";

interface Props {
  target: { ra: number; dec: number; name: string; id: string };
  onWWT: () => void;
  onCutout: () => void;
  onClose: () => void;
}

export function AnomalyInspectModal({ target, onWWT, onCutout, onClose }: Props) {
  return (
    <div
      className="anomaly-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Inspect target"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="anomaly-modal">
        <button className="anomaly-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2 className="anomaly-modal-title">How would you like to inspect this target?</h2>
        <p className="anomaly-modal-subtitle">{target.name} · RA {target.ra.toFixed(4)}° Dec {target.dec.toFixed(4)}°</p>
        <div className="anomaly-modal-choices">
          <button className="anomaly-choice wwt-choice" onClick={onWWT}>
            <span className="anomaly-choice-icon" aria-hidden="true">🌐</span>
            <strong>Open in WWT Viewport</strong>
            <span>Fly to target in the full-sky WorldWide Telescope viewer with smooth animation</span>
          </button>
          <button className="anomaly-choice cutout-choice" onClick={onCutout}>
            <span className="anomaly-choice-icon" aria-hidden="true">🔭</span>
            <strong>8′ Cutout Inspector &amp; Graphs</strong>
            <span>Load multi-epoch cutout images, light curves, SED plots and Gaia cross-match</span>
          </button>
        </div>
      </div>
    </div>
  );
}
