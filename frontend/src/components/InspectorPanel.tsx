"use client";

import { useState } from "react";
import type { CandidateSource, ChallengePreset, EpochVisit, AsteroidMatch } from "@/types/cutout";

interface InspectorPanelProps {
  preset: ChallengePreset;
  currentEpoch: EpochVisit | null;
  pixelInfo: { x: number; y: number; ra: number; dec: number; flux: number } | null;
  candidates: CandidateSource[];
  asteroidMatches: AsteroidMatch[];
  onExportPacket: () => void;
  onShare: () => void;
}

export function InspectorPanel({ preset, currentEpoch, pixelInfo, candidates, asteroidMatches, onExportPacket, onShare }: InspectorPanelProps) {
  const [showOffsets, setShowOffsets] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  const mainCandidate = candidates[0];
  const tagCounts = {
    moving: candidates.filter((c) => c.tags.includes("moving")).length,
    variable: candidates.filter((c) => c.tags.includes("variable")).length,
    veryRed: candidates.filter((c) => c.tags.includes("very-red")).length,
    notInGaia: candidates.filter((c) => c.tags.includes("not-in-gaia")).length,
  };

  const displayedCandidates = showAllCandidates ? candidates : candidates.slice(0, 5);

  return (
    <div className="inspector-panel">
      <div className="inspector-section">
        <h3 className="inspector-title">{preset.name}</h3>
        <p className="inspector-desc">{preset.watchFor}</p>
      </div>

      <div className="inspector-section">
        <h4>Inspector</h4>
        <div className="inspector-grid">
          <div className="inspector-item"><span className="label">frame</span><span>{currentEpoch ? `${currentEpoch.label} · ${currentEpoch.detector}` : "—"}</span></div>
          <div className="inspector-item"><span className="label">λ</span><span>{currentEpoch?.wavelengthRange ?? "—"}</span></div>
          <div className="inspector-item"><span className="label">exposures</span><span>{currentEpoch?.exposures ?? "—"}</span></div>
          {pixelInfo && (
            <>
              <div className="inspector-item"><span className="label">RA</span><span>{pixelInfo.ra.toFixed(5)}°</span></div>
              <div className="inspector-item"><span className="label">Dec</span><span>{pixelInfo.dec.toFixed(5)}°</span></div>
              <div className="inspector-item"><span className="label">flux</span><span>{pixelInfo.flux.toFixed(3)} MJy/sr</span></div>
            </>
          )}
        </div>
      </div>

      <div className="inspector-section">
        <h4>Checked against Gaia</h4>
        {mainCandidate?.gaiaMatch ? (
          <div className="gaia-status match">
            <span className="status-icon">✓</span>
            <span>Matches Gaia: worst {mainCandidate.worstOffsetArcsec?.toFixed(1)}″ ({mainCandidate.worstOffsetPx?.toFixed(2)} px), {mainCandidate.perVisitOffsets?.length ?? 0} visits</span>
          </div>
        ) : (
          <div className="gaia-status nomatch">
            <span className="status-icon">⊘</span>
            <span>No Gaia DR3 counterpart within 2.5″ — high-priority candidate</span>
          </div>
        )}
        {mainCandidate?.perVisitOffsets && mainCandidate.perVisitOffsets.length > 0 && (
          <button className="expand-btn" onClick={() => setShowOffsets(!showOffsets)}>
            {showOffsets ? "▼" : "▶"} Per-visit offsets
          </button>
        )}
        {showOffsets && mainCandidate?.perVisitOffsets && (
          <div className="offset-list">
            {mainCandidate.perVisitOffsets.map((o) => (
              <div key={o.epoch} className="offset-row">
                <span>{o.epoch}</span>
                <span>{o.offsetArcsec.toFixed(2)}″ ({o.offsetPx.toFixed(2)} px)</span>
              </div>
            ))}
          </div>
        )}
        {mainCandidate?.properMotion && (
          <div className="pm-info">
            <strong>Proper motion:</strong> {mainCandidate.properMotion.toFixed(2)} ± {mainCandidate.properMotionUncertainty?.toFixed(2)} ″/yr
            <br /><small>PA {mainCandidate.properMotionPA}° · ~{mainCandidate.pixelShift?.toFixed(1)} px across baseline</small>
          </div>
        )}
      </div>

      <div className="inspector-section">
        <h4>Solar System Check</h4>
        {asteroidMatches.length > 0 ? (
          <div className="asteroid-warning">
            <span className="warn-icon">⚠</span>
            <div>
              <strong>Known Solar System Object: {asteroidMatches[0].name}</strong>
              <br /><small>{asteroidMatches[0].offsetArcsec.toFixed(1)}″ offset ({asteroidMatches[0].velocityArcsecHr.toFixed(1)}″/hr) · {asteroidMatches[0].type}</small>
              <br /><span className="tag-badge fp">Known Asteroid (False Positive)</span>
            </div>
          </div>
        ) : (
          <div className="gaia-status match">
            <span className="status-icon">✓</span>
            <span>Clear of known Solar System bodies (SkyBoT/JPL checked)</span>
          </div>
        )}
      </div>

      <div className="inspector-section">
        <h4>Candidates</h4>
        <div className="candidate-summary">
          {candidates.length} sources · {tagCounts.moving} moving · {tagCounts.variable} variable · {tagCounts.veryRed} very red · {tagCounts.notInGaia} not in Gaia
        </div>
        <div className="candidate-tags">
          {tagCounts.moving > 0 && <span className="tag-badge moving">Moving</span>}
          {tagCounts.variable > 0 && <span className="tag-badge variable">Variable</span>}
          {tagCounts.veryRed > 0 && <span className="tag-badge very-red">Very Red</span>}
          {tagCounts.notInGaia > 0 && <span className="tag-badge not-gaia">Not in Gaia</span>}
        </div>
        <div className="candidate-list">
          {displayedCandidates.map((c) => (
            <div key={c.id} className="candidate-row">
              <span className="candidate-id">{c.id.replace(`cand-main-${preset.id}`, "Primary").replace(`cand-field-${preset.id}-`, "Field ")}</span>
              <div className="candidate-tags-inline">
                {c.tags.map((t) => <span key={t} className={`tag-mini ${t}`}>{t}</span>)}
              </div>
              {c.properMotion && <span className="candidate-pm">{c.properMotion.toFixed(1)}″/yr</span>}
              {c.saturated && <span className="tag-mini saturated">Saturated</span>}
            </div>
          ))}
        </div>
        {candidates.length > 5 && (
          <button className="expand-btn" onClick={() => setShowAllCandidates(!showAllCandidates)}>
            {showAllCandidates ? "Show fewer" : `Show all ${candidates.length}`}
          </button>
        )}
      </div>

      <div className="inspector-actions">
        <button className="action-btn primary" onClick={onShare}>Share View</button>
        <button className="action-btn" onClick={onExportPacket}>Export Discovery Packet</button>
      </div>
    </div>
  );
}
