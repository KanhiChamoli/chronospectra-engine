"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { SpectrumSample } from "@/types/spectroscopy";

interface DualAxisMatrixProps {
  epochs: string[];
  epochA: string;
  epochB: string;
  samplesByEpoch: Record<string, SpectrumSample[]>;
  selectedIndex: number;
  onEpochAChange: (epoch: string) => void;
  onEpochBChange: (epoch: string) => void;
  onOpenSed: () => void;
  onCellSelect: (epoch: string, wavelengthUm: number) => void;
}

interface MatrixRow {
  wavelengthUm: number;
  referenceIndex: number;
  samplesByEpoch: Record<string, SpectrumSample | undefined>;
}

function sortedSamples(samples: SpectrumSample[] = []): SpectrumSample[] {
  return [...samples].sort((a, b) => a.wavelength_um - b.wavelength_um);
}

function closestSample(
  samples: SpectrumSample[],
  wavelengthUm: number,
): SpectrumSample | undefined {
  let closest: SpectrumSample | undefined;
  let difference = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const candidateDifference = Math.abs(sample.wavelength_um - wavelengthUm);
    if (candidateDifference < difference) {
      closest = sample;
      difference = candidateDifference;
    }
  }
  if (!closest) return undefined;
  const tolerance = Math.max(closest.bandwidth_um / 2, 0.005);
  return difference <= tolerance ? closest : undefined;
}

export function DualAxisMatrix({
  epochs,
  epochA,
  epochB,
  samplesByEpoch,
  selectedIndex,
  onEpochAChange,
  onEpochBChange,
  onOpenSed,
  onCellSelect,
}: DualAxisMatrixProps) {
  const sortedByEpoch = useMemo(
    () => Object.fromEntries(
      epochs.map((epoch) => [epoch, sortedSamples(samplesByEpoch[epoch])]),
    ) as Record<string, SpectrumSample[]>,
    [epochs, samplesByEpoch],
  );
  const referenceSamples = useMemo(
    () => sortedByEpoch[epochA] ?? [],
    [epochA, sortedByEpoch],
  );
  const rows = useMemo<MatrixRow[]>(() => referenceSamples.map((sample, index) => ({
    wavelengthUm: sample.wavelength_um,
    referenceIndex: index,
    samplesByEpoch: Object.fromEntries(
      epochs.map((epoch) => [
        epoch,
        closestSample(sortedByEpoch[epoch] ?? [], sample.wavelength_um),
      ]),
    ),
  })), [epochs, referenceSamples, sortedByEpoch]);
  const selectedWavelength = referenceSamples[selectedIndex]?.wavelength_um;
  const fluxRange = useMemo(() => {
    const values = rows.flatMap((row) =>
      epochs.flatMap((epoch) => {
        const flux = row.samplesByEpoch[epoch]?.flux_mjy_sr;
        return flux === undefined ? [] : [Math.log10(Math.abs(flux) + 1e-8)];
      }),
    );
    return {
      min: Math.min(...values, 0),
      max: Math.max(...values, 1),
    };
  }, [epochs, rows]);

  const selectCell = (epoch: string, row: MatrixRow) => {
    if (row.samplesByEpoch[epoch]) onCellSelect(epoch, row.wavelengthUm);
  };

  return (
    <section className="matrix-panel" aria-label="Dual-axis epoch and wavelength matrix">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">DUAL-AXIS TEMPORAL / SPECTRAL MATRIX</p>
          <h2>Time × wavelength</h2>
        </div>
        <span className="matrix-count">{referenceSamples.length} SAMPLES</span>
      </div>
      <div className="epoch-selectors">
        <label>
          <span><i className="legend-cyan" />SED EPOCH A</span>
          <select value={epochA} onChange={(event) => onEpochAChange(event.target.value)} disabled={!epochs.length}>
            {epochs.map((epoch) => <option key={epoch} value={epoch}>{epoch}</option>)}
          </select>
        </label>
        <label>
          <span><i className="legend-amber" />SED EPOCH B</span>
          <select value={epochB} onChange={(event) => onEpochBChange(event.target.value)} disabled={!epochs.length}>
            {epochs.map((epoch) => <option key={epoch} value={epoch}>{epoch}</option>)}
          </select>
        </label>
      </div>
      <div
        className="spectral-matrix-scroll"
        role="grid"
        aria-label="Rows are measured wavelengths; columns are observation epochs"
        style={{ "--epoch-count": Math.max(epochs.length, 1) } as CSSProperties}
      >
        <div className="spectral-matrix-header" role="row">
          <span className="spectral-matrix-axis-label">μm ↓</span>
          {epochs.map((epoch) => (
            <span className="spectral-matrix-epoch" role="columnheader" key={epoch} title={epoch}>
              {epoch.replace("epoch-", "")}
            </span>
          ))}
        </div>
        {rows.map((row) => {
          const isSelected = row.referenceIndex === selectedIndex;
          return (
            <div className="spectral-matrix-row" role="row" key={`${row.wavelengthUm}-${row.referenceIndex}`}>
              <span
                className={`spectral-matrix-wavelength${isSelected ? " selected" : ""}`}
                role="rowheader"
              >
                {row.wavelengthUm.toFixed(3)}
              </span>
              {epochs.map((epoch) => {
                const sample = row.samplesByEpoch[epoch];
                const isBaseline = epoch === epochA;
                const logFlux = sample
                  ? Math.log10(Math.abs(sample.flux_mjy_sr) + 1e-8)
                  : fluxRange.min;
                const intensity = sample
                  ? 0.18 + 0.72 * (
                    (logFlux - fluxRange.min) /
                    Math.max(fluxRange.max - fluxRange.min, 1e-8)
                  )
                  : 0;
                return (
                  <button
                    className={[
                      "spectral-matrix-cell",
                      isSelected && isBaseline ? "selected" : "",
                      sample && sample.flags !== 0 ? "flagged" : "",
                    ].filter(Boolean).join(" ")}
                    type="button"
                    role="gridcell"
                    key={epoch}
                    disabled={!sample}
                    aria-label={sample
                      ? `${epoch}, ${row.wavelengthUm.toFixed(4)} micrometers, ${sample.flux_mjy_sr.toFixed(4)} MJy per steradian, flags ${sample.flags}`
                      : `${epoch}, no measured sample near ${row.wavelengthUm.toFixed(4)} micrometers`}
                    title={sample
                      ? `${epoch} · ${row.wavelengthUm.toFixed(4)} μm · ${sample.flux_mjy_sr.toFixed(4)} MJy/sr · flags ${sample.flags}`
                      : "No measured sample at this wavelength"}
                    style={{
                      "--cell-intensity": intensity,
                      "--cell-color": epoch === epochB ? "255,183,3" : "0,240,255",
                    } as CSSProperties}
                    onClick={() => selectCell(epoch, row)}
                    onPointerEnter={(event) => {
                      if (event.buttons === 1) selectCell(epoch, row);
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="matrix-axis-footer">
        <span>WAVELENGTH · 0.75–5 μm</span>
        <strong>{selectedWavelength === undefined ? "—" : `${selectedWavelength.toFixed(4)} μm`}</strong>
        <span>TIME →</span>
      </div>
      <button
        className="matrix-sed-button"
        type="button"
        onClick={onOpenSed}
        disabled={!referenceSamples.length}
      >
        View SED comparison
      </button>
      <p className="matrix-note">
        Select or drag through measured cells. Color shows relative |flux|; amber flags mark samples for review.
        Missing wavelength/epoch cells are not interpolated.
      </p>
    </section>
  );
}
