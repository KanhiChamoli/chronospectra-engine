"use client";

import { Star } from "lucide-react";
import type { CelestialTarget } from "@/lib/celestialCatalog";
import { calculateSkyPosition } from "@/lib/skyCoordinates";

interface ObjectDetailPanelProps {
  target: CelestialTarget;
  latitude: number | null;
  longitude: number | null;
  onClose: () => void;
  onSave: () => void;
  onViewSpectrum: () => void;
  saveLabel?: string;
}

export function ObjectDetailPanel({
  target,
  latitude,
  longitude,
  onClose,
  onSave,
  onViewSpectrum,
  saveLabel = "Save to Observations",
}: ObjectDetailPanelProps) {
  const visibility =
    latitude === null || longitude === null
      ? null
      : calculateSkyPosition(target.raDeg, target.decDeg, latitude, longitude);
  const wikipediaSlug = encodeURIComponent(target.name.replaceAll(" ", "_"));

  return (
    <section className="object-detail-panel" aria-label={`${target.name} object details`}>
      <header className="object-detail-header">
        <div className="object-symbol" aria-hidden="true"><Star size={17} /></div>
        <div>
          <p className="eyebrow">{target.category}</p>
          <h2>{target.name}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close object details" onClick={onClose}>×</button>
      </header>
      <p className="object-aliases"><strong>Also known as</strong>{target.aliases.join(" · ") || "No alternate designations listed"}</p>
      <dl className="object-metadata">
        <div><dt>Magnitude</dt><dd>{target.magnitude ?? "Not available"}</dd></div>
        <div><dt>Distance</dt><dd>{target.distance ?? "Not available"}</dd></div>
        <div><dt>Spectral type</dt><dd>{target.spectralType ?? "Not available"}</dd></div>
        <div><dt>RA / Dec · ICRS</dt><dd>{(target.raDeg / 15).toFixed(5)} h · {Math.abs(target.decDeg).toFixed(4)}° {target.decDeg >= 0 ? "N" : "S"}</dd></div>
        <div>
          <dt>Az / Alt</dt>
          <dd>
            {visibility
              ? `${visibility.azimuthDeg.toFixed(1)}° / ${visibility.altitudeDeg.toFixed(1)}°`
              : "Allow location for local coordinates"}
          </dd>
        </div>
        <div>
          <dt>Visibility · UTC approx.</dt>
          <dd>
            {visibility
              ? `Rise ${visibility.riseUtc} · Set ${visibility.setUtc}`
              : "Allow location to estimate rise/set"}
          </dd>
        </div>
      </dl>
      <p className="object-summary">
        {target.summary}{" "}
        <a href={`https://en.wikipedia.org/wiki/${wikipediaSlug}`} target="_blank" rel="noreferrer">
          More on Wikipedia ↗
        </a>
      </p>
      <p className="object-source">Reference: {target.source}. Rise/set times are approximate and location-dependent.</p>
      <div className="object-actions">
        <button type="button" className="primary-action" onClick={onSave}>{saveLabel}</button>
        <button type="button" className="secondary-action" onClick={onViewSpectrum}>Open spectrum</button>
      </div>
    </section>
  );
}
