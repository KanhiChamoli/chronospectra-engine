"use client";

import { useMemo, useState } from "react";
import type { RawSpectrumPoint, BinnedSpectrumPoint } from "@/types/cutout";

interface BinnedSpectrumChartProps {
  targetName: string;
  visits: string[];
  selectedVisit: string;
  onVisitChange: (visit: string) => void;
  raw: RawSpectrumPoint[];
  binned: BinnedSpectrumPoint[];
}

const DET_COLORS: Record<string, string> = {
  D1: "#6366f1", D2: "#3b82f6", D3: "#22c55e", D4: "#eab308", D5: "#f97316", D6: "#ef4444",
};

export function BinnedSpectrumChart({ targetName, visits, selectedVisit, onVisitChange, raw, binned }: BinnedSpectrumChartProps) {
  const [hoverInfo, setHoverInfo] = useState<{ wl: number; flux: number; sigma: number; det: string; x: number; y: number } | null>(null);

  const { xRange, yRange } = useMemo(() => {
    const allFlux = [...raw.map((r) => r.flux), ...binned.map((b) => b.flux)].filter((f) => f > 0);
    if (!allFlux.length) return { xRange: [0.75, 5] as [number, number], yRange: [0.01, 100] as [number, number] };
    return {
      xRange: [0.75, 5.0] as [number, number],
      yRange: [Math.max(Math.min(...allFlux) * 0.3, 0.001), Math.max(...allFlux) * 3] as [number, number],
    };
  }, [raw, binned]);

  const W = 600, H = 280, pad = { l: 60, r: 20, t: 30, b: 50 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const logXMin = Math.log10(xRange[0]);
  const logXMax = Math.log10(xRange[1]);
  const logYMin = Math.log10(yRange[0]);
  const logYMax = Math.log10(yRange[1]);
  const xScale = (wl: number) => pad.l + ((Math.log10(wl) - logXMin) / (logXMax - logXMin)) * plotW;
  const yScale = (f: number) => pad.t + plotH - ((Math.log10(Math.max(f, yRange[0])) - logYMin) / (logYMax - logYMin)) * plotH;

  const xTicks = [1, 2, 3, 4, 5];
  const yTicks = [0.1, 1, 10, 100].filter((v) => v >= yRange[0] && v <= yRange[1]);

  return (
    <div className="plot-chart spectrum-chart">
      <div className="chart-header">
        <h4>Spectrum (R=40)</h4>
        <select value={selectedVisit} onChange={(e) => onVisitChange(e.target.value)} className="visit-select">
          {visits.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <span className="chart-subtitle">Brightness of {targetName} against wavelength, 102 SPHEREx channels, one visit</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverInfo(null)}
      >
        {/* H2O ice band */}
        <rect x={xScale(2.85)} y={pad.t} width={xScale(3.15) - xScale(2.85)} height={plotH} fill="#00f0ff" opacity="0.06" />
        <text x={(xScale(2.85) + xScale(3.15)) / 2} y={pad.t + 10} textAnchor="middle" fill="#00f0ff" fontSize="8" opacity="0.7">H₂O ice</text>
        {/* CO2 ice band */}
        <rect x={xScale(4.2)} y={pad.t} width={xScale(4.34) - xScale(4.2)} height={plotH} fill="#ffb703" opacity="0.08" />
        <text x={(xScale(4.2) + xScale(4.34)) / 2} y={pad.t + 10} textAnchor="middle" fill="#ffb703" fontSize="8" opacity="0.7">CO₂ ice</text>

        {/* Grid */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={yScale(t)} y2={yScale(t)} stroke="#1e293b" strokeDasharray="3,3" />
            <text x={pad.l - 6} y={yScale(t) + 3} textAnchor="end" fill="#64748b" fontSize="9">{t >= 1 ? `${t} mJy` : `${t * 1000} µJy`}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={xScale(t)} x2={xScale(t)} y1={pad.t} y2={pad.t + plotH} stroke="#1e293b" strokeDasharray="3,3" />
            <text x={xScale(t)} y={H - 10} textAnchor="middle" fill="#64748b" fontSize="9">{t} µm</text>
          </g>
        ))}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + plotH} stroke="#334155" />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="#334155" />
        <text x={W / 2} y={H - 2} textAnchor="middle" fill="#94a3b8" fontSize="9">Wavelength (µm, log scale)</text>
        <text x={12} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize="9" transform={`rotate(-90,12,${H / 2})`}>Brightness (log scale)</text>

        {/* Raw grey dots */}
        {raw.map((r, i) => (
          <circle key={`r-${i}`} cx={xScale(r.wavelength)} cy={yScale(r.flux)} r={1.5}
            fill={r.saturated ? "transparent" : "#64748b"} stroke={r.saturated ? "#64748b" : "none"} strokeWidth={r.saturated ? 0.8 : 0} opacity={0.4}
            onMouseEnter={() => setHoverInfo({ wl: r.wavelength, flux: r.flux, sigma: r.sigma, det: r.detector, x: xScale(r.wavelength), y: yScale(r.flux) })}
          />
        ))}

        {/* Binned cyan line + markers */}
        {binned.length > 1 && (
          <polyline
            fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8"
            points={binned.map((b) => `${xScale(b.wavelength)},${yScale(b.flux)}`).join(" ")}
          />
        )}
        {binned.map((b, i) => (
          <circle key={`b-${i}`} cx={xScale(b.wavelength)} cy={yScale(b.flux)} r={3}
            fill="#38bdf8" stroke="#0ea5e9" strokeWidth="0.5"
            onMouseEnter={() => setHoverInfo({ wl: b.wavelength, flux: b.flux, sigma: b.sigma, det: b.detector, x: xScale(b.wavelength), y: yScale(b.flux) })}
          />
        ))}

        {/* Hover tooltip */}
        {hoverInfo && (
          <g>
            <rect x={hoverInfo.x + 8} y={hoverInfo.y - 30} width={130} height={40} rx="4" fill="#0f172a" stroke="#334155" />
            <text x={hoverInfo.x + 14} y={hoverInfo.y - 16} fill="#e2e8f0" fontSize="8">λ {hoverInfo.wl.toFixed(3)} µm · {hoverInfo.det}</text>
            <text x={hoverInfo.x + 14} y={hoverInfo.y - 4} fill="#38bdf8" fontSize="8">{hoverInfo.flux.toFixed(3)} mJy · σ {hoverInfo.sigma.toFixed(4)}</text>
          </g>
        )}
      </svg>
      <p className="chart-caption">Grey: single exposures. Cyan: weighted mean in bins of R = 40. Hollow: saturated. One visit only, so a variable star doesn&apos;t blur.</p>
    </div>
  );
}
