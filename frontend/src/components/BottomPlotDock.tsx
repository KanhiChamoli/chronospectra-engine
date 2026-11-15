"use client";

import { useState } from "react";
import { LightCurveChart } from "./LightCurveChart";
import { BinnedSpectrumChart } from "./BinnedSpectrumChart";
import type { TargetPhotometry } from "@/types/cutout";

interface BottomPlotDockProps {
  photometry: TargetPhotometry | null;
  selectedEpoch: string;
  onEpochSelect: (epoch: string) => void;
}

type PlotView = "hidden" | "lightcurve" | "spectrum" | "both";

export function BottomPlotDock({ photometry, selectedEpoch, onEpochSelect }: BottomPlotDockProps) {
  const [view, setView] = useState<PlotView>("hidden");
  const [spectrumVisit, setSpectrumVisit] = useState(selectedEpoch || photometry?.visits[3] || "");

  const visit = spectrumVisit || photometry?.visits[0] || "";
  const spectrumData = photometry?.spectraByVisit[visit];

  return (
    <div className="bottom-plot-dock">
      <div className="plot-dock-bar">
        <button className={`dock-btn${view === "lightcurve" ? " active" : ""}`} onClick={() => setView(view === "lightcurve" ? "hidden" : "lightcurve")}>
          📈 Light Curve
        </button>
        <button className={`dock-btn${view === "spectrum" ? " active" : ""}`} onClick={() => setView(view === "spectrum" ? "hidden" : "spectrum")}>
          🌈 102-Band Spectrum
        </button>
        <button className={`dock-btn${view === "both" ? " active" : ""}`} onClick={() => setView(view === "both" ? "hidden" : "both")}>
          ⊞ Split View
        </button>
        {view !== "hidden" && (
          <button className="dock-btn hide-btn" onClick={() => setView("hidden")}>▼ Hide Plots</button>
        )}
      </div>
      {view !== "hidden" && photometry && (
        <div className={`plot-dock-content ${view === "both" ? "split" : "single"}`}>
          {(view === "lightcurve" || view === "both") && (
            <LightCurveChart
              lightCurve={photometry.lightCurve}
              targetName={photometry.targetName}
              selectedEpoch={selectedEpoch}
              onEpochSelect={(ep) => { onEpochSelect(ep); setSpectrumVisit(ep); }}
            />
          )}
          {(view === "spectrum" || view === "both") && (
            <BinnedSpectrumChart
              targetName={photometry.targetName}
              visits={photometry.visits}
              selectedVisit={visit}
              onVisitChange={setSpectrumVisit}
              raw={spectrumData?.raw ?? []}
              binned={spectrumData?.binnedR40 ?? []}
            />
          )}
        </div>
      )}
      {view !== "hidden" && !photometry && (
        <div className="plot-dock-empty">Select a target or preset to view photometry and spectra.</div>
      )}
    </div>
  );
}
