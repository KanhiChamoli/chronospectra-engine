"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildSedComparison } from "@/lib/sed";
import { tellSpectrumStory } from "@/lib/storyteller";
import type { SpectrumResponse } from "@/types/spectroscopy";

interface SedModalProps {
  spectrum: SpectrumResponse;
  epochA: string;
  epochB: string;
  selectedWavelength: number | null;
  onClose: () => void;
}

export function SedModal({
  spectrum,
  epochA,
  epochB,
  selectedWavelength,
  onClose,
}: SedModalProps) {
  const epochs = spectrum.epochs;
  const chartData = buildSedComparison(epochs[epochA] ?? [], epochs[epochB] ?? []);
  const story = tellSpectrumStory(
    epochs[epochA] ?? [],
    epochs[epochB] ?? [],
    epochA,
    epochB,
    spectrum.synthetic,
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="sed-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sed-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">PIXEL SPECTRAL EXTRACTION</p>
            <h2 id="sed-title">Spectral energy distribution</h2>
            <p className="coordinate">
              RA {spectrum.ra_deg.toFixed(5)}° · DEC {spectrum.dec_deg.toFixed(5)}°
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close spectrum">
            ×
          </button>
        </header>
        <div className="chart-legend">
          <span><i className="legend-cyan" />{epochA || "Epoch A"}</span>
          <span><i className="legend-amber" />{epochB || "Epoch B"}</span>
          <span className="chart-unit">SURFACE BRIGHTNESS · MJy/sr</span>
        </div>
        <p className="cosmic-story" aria-live="polite">
          <strong>Cosmic Storyteller</strong>
          {story}
        </p>
        <div className="sed-chart">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#242934" strokeDasharray="3 5" />
                <XAxis
                  type="number"
                  dataKey="wavelength_um"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fill: "#929baa", fontSize: 11 }}
                  label={{ value: "Wavelength (μm)", position: "insideBottom", offset: -3, fill: "#a9b3c2" }}
                />
                <YAxis
                  tick={{ fill: "#929baa", fontSize: 11 }}
                  label={{ value: "Flux (MJy/sr)", angle: -90, position: "insideLeft", fill: "#a9b3c2" }}
                />
                <Tooltip
                  contentStyle={{ background: "#0b0d13", border: "1px solid #29313b", borderRadius: 8 }}
                  labelFormatter={(value) => `${Number(value).toFixed(4)} μm`}
                  formatter={(value, name) => [
                    value == null ? "—" : `${Number(value).toFixed(5)} MJy/sr`,
                    name === "epochA" ? epochA : epochB,
                  ]}
                />
                <ReferenceArea x1={2.85} x2={3.15} fill="#00f0ff" fillOpacity={0.09} label={{ value: "H₂O ice", fill: "#78dce4", fontSize: 10, position: "insideTop" }} />
                <ReferenceArea x1={4.2} x2={4.34} fill="#ffb703" fillOpacity={0.14} label={{ value: "CO₂ ice", fill: "#ffd166", fontSize: 10, position: "insideTop" }} />
                {selectedWavelength !== null && (
                  <ReferenceArea
                    x1={selectedWavelength - 0.015}
                    x2={selectedWavelength + 0.015}
                    fill="#ffffff"
                    fillOpacity={0.12}
                  />
                )}
                <Line type="linear" dataKey="epochA" name="epochA" stroke="#00f0ff" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                <Line type="linear" dataKey="epochB" name="epochB" stroke="#ffb703" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-chart">No matched samples for the selected epochs.</p>
          )}
        </div>
        <footer className="modal-footer">
          <span>{spectrum.available_sample_count} available samples · {spectrum.product_count} detector products</span>
          <span>
            {spectrum.synthetic && "SYNTHETIC DEMO · "}
            Flags are preserved in sample metadata; inspect before scientific interpretation.
          </span>
        </footer>
      </section>
    </div>
  );
}
