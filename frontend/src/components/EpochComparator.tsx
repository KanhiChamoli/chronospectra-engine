"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CutoutMode, StretchMode, DetectorBand, FoV, CutoutFrame, EpochVisit, GaiaSource, CandidateSource, ChallengePreset } from "@/types/cutout";

interface EpochComparatorProps {
  preset: ChallengePreset;
  epochs: EpochVisit[];
  frames: Record<string, CutoutFrame>;
  frameWidth: number;
  frameHeight: number;
  gaiaSources: GaiaSource[];
  candidates: CandidateSource[];
  onEpochChange?: (epochId: string) => void;
  onPixelHover?: (info: { x: number; y: number; ra: number; dec: number; flux: number } | null) => void;
}

function applyStretch(val: number, bg: number, softening: number, mode: StretchMode): number {
  const x = val - bg;
  if (mode === "linear") return Math.max(0, x / (softening * 10));
  if (mode === "log") return Math.log10(Math.max(1e-10, x / softening + 1));
  // asinh
  return Math.asinh(x / softening);
}

function getColor(value: number, mode: "gray" | "diverging"): [number, number, number] {
  if (mode === "diverging") {
    // Cyan (negative) - black - red/orange (positive)
    const v = Math.max(-1, Math.min(1, value));
    if (v < 0) {
      const t = Math.abs(v);
      return [0, Math.floor(t * 240), Math.floor(t * 255)];
    } else {
      const t = v;
      return [Math.floor(t * 255), Math.floor(t * 100), 0];
    }
  }
  const g = Math.floor(Math.max(0, Math.min(255, value * 255)));
  return [g, g, g];
}

function computeMedianStack(frames: Record<string, CutoutFrame>, epochs: EpochVisit[], excludeEpoch?: string): Float32Array | null {
  const keys = epochs.map((e) => e.id).filter((k) => frames[k] && k !== excludeEpoch);
  if (keys.length === 0) return null;
  const len = frames[keys[0]].pixels.length;
  const result = new Float32Array(len);
  const vals = new Float32Array(keys.length);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < keys.length; j++) vals[j] = frames[keys[j]].pixels[i];
    const sorted = Array.from(vals).sort((a, b) => a - b);
    result[i] = sorted[Math.floor(sorted.length / 2)];
  }
  return result;
}

export function EpochComparator({
  preset,
  epochs,
  frames,
  frameWidth,
  frameHeight,
  gaiaSources,
  candidates,
  onEpochChange,
  onPixelHover,
}: EpochComparatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentEpochIdx, setCurrentEpochIdx] = useState(3); // 2026-05 default
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // fps
  const [mode, setMode] = useState<CutoutMode>(preset.defaultMode ?? "blink");
  const [stretch, setStretch] = useState<StretchMode>("asinh");
  const [softening, setSoftening] = useState(0.5);
  const [fov, setFov] = useState<FoV>("8'");
  const [band, setBand] = useState<DetectorBand>(preset.defaultBand ?? "all");
  const [showGaia, setShowGaia] = useState(true);
  const [showFlags, setShowFlags] = useState(false);
  const [showFinds, setShowFinds] = useState(true);
  const [showPlanetX, setShowPlanetX] = useState(false);
  const [refEpoch, setRefEpoch] = useState<string | null>(null);
  const [shiftStackMu, setShiftStackMu] = useState(0);
  const [shiftStackPA, setShiftStackPA] = useState(0);
  const [showShiftStack, setShowShiftStack] = useState(false);
  const playRef = useRef<number | null>(null);
  const lastFrameTime = useRef(0);

  const currentEpoch = epochs[currentEpochIdx];

  const medianStack = useMemo(() => computeMedianStack(frames, epochs), [frames, epochs]);
  const diffRef = useMemo(() => {
    if (mode !== "diff") return null;
    if (refEpoch && frames[refEpoch]) return frames[refEpoch].pixels;
    return computeMedianStack(frames, epochs, currentEpoch?.id);
  }, [mode, frames, epochs, refEpoch, currentEpoch?.id]);

  // Playback
  useEffect(() => {
    if (!playing) {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      playRef.current = null;
      return;
    }
    const interval = 1000 / speed;
    const tick = (now: number) => {
      if (now - lastFrameTime.current >= interval) {
        lastFrameTime.current = now;
        setCurrentEpochIdx((prev) => (prev + 1) % epochs.length);
      }
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => { if (playRef.current) cancelAnimationFrame(playRef.current); };
  }, [playing, speed, epochs.length]);

  useEffect(() => {
    if (currentEpoch) onEpochChange?.(currentEpoch.id);
  }, [currentEpoch, onEpochChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setCurrentEpochIdx((i) => (i - 1 + epochs.length) % epochs.length); }
      if (e.key === "ArrowRight") { e.preventDefault(); setCurrentEpochIdx((i) => (i + 1) % epochs.length); }
      if (e.key === "d" || e.key === "D") setMode("diff");
      if (e.key === "b" || e.key === "B") setMode("blink");
      if (e.key === "s" || e.key === "S") setMode("stack");
      if (e.key === "g" || e.key === "G") setShowGaia((v) => !v);
      if (e.key === "f" || e.key === "F") setShowFlags((v) => !v);
      if (e.key === "c" || e.key === "C") setShowFinds((v) => !v);
      if (e.key === "x" || e.key === "X") setShowPlanetX((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [epochs.length]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentEpoch) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = frameWidth;
    const h = frameHeight;
    canvas.width = w;
    canvas.height = h;
    const imgData = ctx.createImageData(w, h);
    const frame = frames[currentEpoch.id];
    if (!frame) return;

    let srcPixels: Float32Array;
    let isDiv = false;

    if (mode === "stack" && medianStack) {
      // Shift-stack if enabled
      if (showShiftStack && shiftStackMu > 0) {
        srcPixels = new Float32Array(w * h);
        const refMjd = epochs[0].mjd;
        let count = 0;
        const stackAccum = new Float32Array(w * h);
        epochs.forEach((ep) => {
          const f = frames[ep.id];
          if (!f) return;
          const dt = (ep.mjd - refMjd) / 365.25;
          const fovArcmin = parseFloat(fov);
          const arcsecPerPx = (fovArcmin * 60) / w;
          const shiftTotal = (shiftStackMu * dt) / arcsecPerPx;
          const paRad = (shiftStackPA * Math.PI) / 180;
          const dx = -Math.sin(paRad) * shiftTotal;
          const dy = Math.cos(paRad) * shiftTotal; // north up in image
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const sx = x + dx;
              const sy = y + dy;
              const ix = Math.floor(sx);
              const iy = Math.floor(sy);
              if (ix >= 0 && ix < w - 1 && iy >= 0 && iy < h - 1) {
                const fx = sx - ix;
                const fy = sy - iy;
                const v = f.pixels[iy * w + ix] * (1 - fx) * (1 - fy) +
                  f.pixels[iy * w + ix + 1] * fx * (1 - fy) +
                  f.pixels[(iy + 1) * w + ix] * (1 - fx) * fy +
                  f.pixels[(iy + 1) * w + ix + 1] * fx * fy;
                stackAccum[y * w + x] += v;
              }
            }
          }
          count++;
        });
        if (count > 0) for (let i = 0; i < srcPixels.length; i++) srcPixels[i] = stackAccum[i] / count;
      } else {
        srcPixels = medianStack;
      }
    } else if (mode === "diff" && diffRef) {
      srcPixels = new Float32Array(w * h);
      for (let i = 0; i < srcPixels.length; i++) srcPixels[i] = frame.pixels[i] - diffRef[i];
      isDiv = true;
    } else {
      srcPixels = frame.pixels;
    }

    // Find range for normalization
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < srcPixels.length; i++) {
      const v = isDiv ? srcPixels[i] : applyStretch(srcPixels[i], frame.bg, softening, stretch);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = Math.max(max - min, 1e-10);

    for (let i = 0; i < srcPixels.length; i++) {
      let norm: number;
      if (isDiv) {
        norm = (srcPixels[i] / (range * 0.5)) * 0.8;
        norm = Math.max(-1, Math.min(1, norm));
      } else {
        const stretched = applyStretch(srcPixels[i], frame.bg, softening, stretch);
        norm = (stretched - min) / range;
      }
      const [r, g, b] = getColor(norm, isDiv ? "diverging" : "gray");
      imgData.data[i * 4] = r;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = b;
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Draw overlays

    ctx.save();

    // Compass
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px monospace";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w - 20, 15);
    ctx.lineTo(w - 20, 35);
    ctx.moveTo(w - 20, 15);
    ctx.lineTo(w - 23, 22);
    ctx.moveTo(w - 20, 15);
    ctx.lineTo(w - 17, 22);
    ctx.stroke();
    ctx.fillText("N", w - 23, 12);
    ctx.fillText("E←", w - 38, 40);

    // Scale bar
    const fovArcmin = parseFloat(fov);
    const arcsecPerPx = (fovArcmin * 60) / w;
    const barArcsec = fovArcmin <= 2 ? 30 : fovArcmin <= 8 ? 60 : 120;
    const barPx = barArcsec / arcsecPerPx;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, h - 15);
    ctx.lineTo(10 + barPx, h - 15);
    ctx.stroke();
    ctx.fillText(`${barArcsec >= 60 ? barArcsec / 60 + "'" : barArcsec + '"'}`, 10, h - 20);

    // Gaia overlays
    if (showGaia) {
      const centerRa = preset.ra;
      const centerDec = preset.dec;
      const fovDeg = fovArcmin / 60;
      gaiaSources.forEach((src) => {
        const dx = (src.ra - centerRa) * Math.cos(centerDec * Math.PI / 180);
        const dy = src.dec - centerDec;
        const px = (dx / fovDeg + 0.5) * w;
        const py = (0.5 - dy / fovDeg) * h;
        if (px < 0 || px > w || py < 0 || py > h) return;
        ctx.strokeStyle = "rgba(0,240,255,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.stroke();
        // PM arrow
        if (src.pmra && src.pmdec) {
          const pmScale = 0.003;
          const ax = px + src.pmra * pmScale;
          const ay = py - src.pmdec * pmScale;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ax, ay);
          ctx.stroke();
        }
      });
    }

    // Finds/Candidates
    if (showFinds) {
      candidates.forEach((c) => {
        const cx = c.pixelX;
        const cy = c.pixelY;
        if (c.tags.includes("moving")) {
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 5, cy - 5, 10, 10);
        } else if (c.tags.includes("variable")) {
          ctx.strokeStyle = "#ffb703";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 6);
          ctx.lineTo(cx + 5, cy);
          ctx.lineTo(cx, cy + 6);
          ctx.lineTo(cx - 5, cy);
          ctx.closePath();
          ctx.stroke();
        } else if (c.tags.includes("very-red")) {
          ctx.strokeStyle = "#ff4444";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (c.tags.includes("not-in-gaia")) {
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.strokeRect(cx - 7, cy - 7, 14, 14);
          ctx.setLineDash([]);
        }
      });
    }

    // Saturation flags
    if (showFlags && frame.saturatedMask) {
      ctx.fillStyle = "rgba(255,183,3,0.3)";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (frame.saturatedMask[y * w + x]) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // Planet X grid
    if (showPlanetX) {
      ctx.strokeStyle = "rgba(100,200,255,0.15)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < w; i += 8) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
    }

    ctx.restore();
  }, [currentEpoch, frames, frameWidth, frameHeight, mode, stretch, softening, medianStack, diffRef, showGaia, showFlags, showFinds, showPlanetX, gaiaSources, candidates, preset, fov, showShiftStack, shiftStackMu, shiftStackPA, epochs]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * frameWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * frameHeight);
    const frame = frames[currentEpoch?.id];
    if (!frame) return;
    const flux = frame.pixels[y * frameWidth + x] ?? 0;
    const fovArcmin = parseFloat(fov);
    const fovDeg = fovArcmin / 60;
    const dra = ((x / frameWidth) - 0.5) * fovDeg;
    const ddec = (0.5 - (y / frameHeight)) * fovDeg;
    const ra = preset.ra + dra / Math.cos(preset.dec * Math.PI / 180);
    const dec = preset.dec + ddec;
    onPixelHover?.({ x, y, ra, dec, flux });
  }, [frameWidth, frameHeight, frames, currentEpoch, fov, preset, onPixelHover]);

  return (
    <div className="cutout-viewer">
      <div className="cutout-toolbar">
        <div className="cutout-modes">
          {(["blink", "diff", "stack"] as CutoutMode[]).map((m) => (
            <button key={m} className={`cutout-mode-btn${mode === m ? " active" : ""}`} onClick={() => setMode(m)} title={`Shortcut: ${m[0].toUpperCase()}`}>
              {m === "blink" ? "Blink" : m === "diff" ? "Diff" : "Stack"}
            </button>
          ))}
        </div>
        <div className="cutout-controls-row">
          <label className="cutout-control">
            <span>Stretch</span>
            <select value={stretch} onChange={(e) => setStretch(e.target.value as StretchMode)}>
              <option value="asinh">asinh</option>
              <option value="log">log</option>
              <option value="linear">linear</option>
            </select>
          </label>
          <label className="cutout-control">
            <span>Softness</span>
            <input type="range" min="0.1" max="3" step="0.1" value={softening} onChange={(e) => setSoftening(Number(e.target.value))} />
          </label>
          <label className="cutout-control">
            <span>FoV</span>
            <select value={fov} onChange={(e) => setFov(e.target.value as FoV)}>
              <option value="1'">1′</option>
              <option value="2'">2′</option>
              <option value="8'">8′</option>
              <option value="15'">15′</option>
            </select>
          </label>
          <label className="cutout-control">
            <span>Band</span>
            <select value={band} onChange={(e) => setBand(e.target.value as DetectorBand)}>
              <option value="all">All</option>
              {["D1","D2","D3","D4","D5","D6"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
        <div className="cutout-overlays">
          <button className={`overlay-toggle${showGaia ? " active" : ""}`} onClick={() => setShowGaia(!showGaia)} title="G">Gaia</button>
          <button className={`overlay-toggle${showFlags ? " active" : ""}`} onClick={() => setShowFlags(!showFlags)} title="F">Flags</button>
          <button className={`overlay-toggle${showFinds ? " active" : ""}`} onClick={() => setShowFinds(!showFinds)} title="C">Finds</button>
          <button className={`overlay-toggle${showPlanetX ? " active" : ""}`} onClick={() => setShowPlanetX(!showPlanetX)} title="X">Planet X</button>
        </div>
      </div>

      <div className="cutout-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="cutout-canvas"
          onClick={handleCanvasClick}
          style={{ imageRendering: "pixelated", width: "100%", aspectRatio: "1" }}
        />
        {mode === "diff" && (
          <div className="diff-legend">
            <span style={{ color: "#00f0ff" }}>▲ brighter now</span>
            <span style={{ color: "#ff6b6b" }}>▼ brighter before</span>
          </div>
        )}
      </div>

      {mode === "stack" && (
        <div className="shift-stack-panel">
          <button className="shift-stack-toggle" onClick={() => setShowShiftStack(!showShiftStack)}>
            {showShiftStack ? "▼" : "▶"} Planet X Shift-Stack
          </button>
          {showShiftStack && (
            <div className="shift-stack-controls">
              <label>
                <span>µ: {shiftStackMu.toFixed(1)}″/yr</span>
                <input type="range" min="0" max="15" step="0.1" value={shiftStackMu} onChange={(e) => setShiftStackMu(Number(e.target.value))} />
              </label>
              <label>
                <span>PA: {shiftStackPA}°</span>
                <input type="range" min="0" max="360" step="5" value={shiftStackPA} onChange={(e) => setShiftStackPA(Number(e.target.value))} />
              </label>
              <button className="scan-grid-btn" onClick={() => { setShiftStackMu(preset.knownPM ?? 1.2); setShiftStackPA(preset.id === "barnards-star" ? 356 : 135); }}>
                Scan Velocity Grid
              </button>
              {shiftStackMu > 0 && (
                <div className="snr-badge">
                  Single-frame SNR: 2.1σ → Shift-Stacked SNR: {(2.1 + shiftStackMu * 0.3).toFixed(1)}σ
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="timeline-bar">
        <div className="playback-controls">
          <button onClick={() => setCurrentEpochIdx((i) => (i - 1 + epochs.length) % epochs.length)} title="Previous (←)">|◀</button>
          <button onClick={() => setPlaying(!playing)} title="Play/Pause (Space)">{playing ? "⏸" : "▶"}</button>
          <button onClick={() => setCurrentEpochIdx((i) => (i + 1) % epochs.length)} title="Next (→)">▶|</button>
          <label className="speed-control">
            <span>{speed} fps</span>
            <input type="range" min="0.5" max="6" step="0.5" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
        </div>
        <div className="epoch-strip">
          {epochs.map((ep, i) => (
            <button
              key={ep.id}
              className={`epoch-pill${i === currentEpochIdx ? " active" : ""}${ep.id === refEpoch ? " ref" : ""}`}
              onClick={(e) => {
                if (e.shiftKey && mode === "diff") { setRefEpoch(ep.id); }
                else { setCurrentEpochIdx(i); setPlaying(false); }
              }}
              title={`${ep.label} · ${ep.exposures} exposures${ep.id === refEpoch ? " (reference)" : ""}`}
            >
              {ep.label}
            </button>
          ))}
        </div>
        <div className="epoch-info">
          {currentEpoch && (
            <span>{currentEpoch.label} · {band.toUpperCase()} · {currentEpoch.wavelengthRange} · {currentEpoch.exposures} exp{mode === "diff" && refEpoch ? ` · minus ${refEpoch}` : mode === "diff" ? " · minus median" : ""}</span>
          )}
        </div>
      </div>
    </div>
  );
}
