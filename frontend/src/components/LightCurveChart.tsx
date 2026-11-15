"use client";

import { useMemo } from "react";
import type { PhotometryPoint } from "@/types/cutout";

interface LightCurveChartProps {
  lightCurve: PhotometryPoint[];
  targetName: string;
  selectedEpoch?: string;
  onEpochSelect?: (epoch: string) => void;
}

const DET_COLORS: Record<string, string> = {
  D1: "#6366f1", D2: "#3b82f6", D3: "#22c55e", D4: "#eab308", D5: "#f97316", D6: "#ef4444",
};

export function LightCurveChart({ lightCurve, targetName, selectedEpoch, onEpochSelect }: LightCurveChartProps) {
  const { points, xRange, yRange } = useMemo(() => {
    if (!lightCurve.length) return { points: [], xRange: [0, 1] as [number, number], yRange: [0, 1] as [number, number], epochs: [] as string[] };
    const fluxes = lightCurve.map((p) => p.flux * (p.fluxUnit === "µJy" ? 0.001 : 1)); // normalize to mJy
    const minFlux = Math.min(...fluxes.filter((f) => f > 0));
    const maxFlux = Math.max(...fluxes);
    const dates = lightCurve.map((p) => new Date(p.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const eps = [...new Set(lightCurve.map((p) => p.epoch))];
    return {
      points: lightCurve.map((p, i) => ({ ...p, fluxMjy: fluxes[i], time: dates[i] })),
      xRange: [minDate - 86400000 * 15, maxDate + 86400000 * 15] as [number, number],
      yRange: [Math.max(minFlux * 0.5, 0.001), maxFlux * 2] as [number, number],
      epochs: eps,
    };
  }, [lightCurve]);

  if (!points.length) return <div className="chart-empty">No light curve data for this target.</div>;

  const W = 600, H = 280, pad = { l: 60, r: 20, t: 20, b: 50 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xScale = (t: number) => pad.l + ((t - xRange[0]) / (xRange[1] - xRange[0])) * plotW;
  const logMin = Math.log10(yRange[0]);
  const logMax = Math.log10(yRange[1]);
  const yScale = (f: number) => pad.t + plotH - ((Math.log10(Math.max(f, yRange[0])) - logMin) / (logMax - logMin)) * plotH;

  const yTicks = [0.03, 0.1, 0.3, 1, 3, 10, 30].filter((v) => v >= yRange[0] && v <= yRange[1]);
  const xTicks: number[] = [];
  const startMonth = new Date(xRange[0]);
  startMonth.setDate(1);
  for (let d = new Date(startMonth); d.getTime() <= xRange[1]; d.setMonth(d.getMonth() + 2)) {
    xTicks.push(d.getTime());
  }

  return (
    <div className="plot-chart light-curve-chart">
      <div className="chart-header">
        <h4>Light Curve</h4>
        <span className="chart-subtitle">Brightness of {targetName} on every exposure, over time</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
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
            <text x={xScale(t)} y={H - 10} textAnchor="middle" fill="#64748b" fontSize="9">
              {new Date(t).toISOString().slice(0, 7)}
            </text>
          </g>
        ))}
        {/* Axes */}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + plotH} stroke="#334155" />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="#334155" />
        <text x={W / 2} y={H - 2} textAnchor="middle" fill="#94a3b8" fontSize="9">Date observed (UTC, linear scale)</text>
        <text x={12} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize="9" transform={`rotate(-90,12,${H / 2})`}>Brightness (log scale)</text>
        {/* Points */}
        {points.map((p, i) => {
          const cx = xScale(p.time);
          const cy = yScale(p.fluxMjy);
          const color = DET_COLORS[p.detector] ?? "#fff";
          return (
            <g key={i} onClick={() => onEpochSelect?.(p.epoch)} style={{ cursor: "pointer" }}>
              {p.sigma > 0 && (
                <line x1={cx} x2={cx} y1={yScale(p.fluxMjy - p.sigma * 0.001)} y2={yScale(p.fluxMjy + p.sigma * 0.001)} stroke={color} strokeWidth="1" opacity="0.4" />
              )}
              <circle cx={cx} cy={cy} r={selectedEpoch === p.epoch ? 5 : 3.5} fill={p.saturated ? "transparent" : color} stroke={color} strokeWidth={p.saturated ? 1.5 : 0.5} opacity={0.9} />
            </g>
          );
        })}
      </svg>
      <div className="chart-legend-row">
        {Object.entries(DET_COLORS).map(([det, color]) => (
          <span key={det} className="legend-item"><span className="legend-dot" style={{ background: color }} />{det}</span>
        ))}
        <span className="legend-item"><span className="legend-dot hollow" />○ saturated</span>
      </div>
    </div>
  );
}
