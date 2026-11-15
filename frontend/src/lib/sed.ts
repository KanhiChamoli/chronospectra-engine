import type { SpectrumSample } from "@/types/spectroscopy";

export interface SedPoint {
  wavelength_um: number;
  epochA?: number;
  epochB?: number;
  sigmaA?: number;
  sigmaB?: number;
}

export function buildSedComparison(
  samplesA: SpectrumSample[],
  samplesB: SpectrumSample[],
): SedPoint[] {
  const sortedA = [...samplesA].sort((a, b) => a.wavelength_um - b.wavelength_um);
  const sortedB = [...samplesB].sort((a, b) => a.wavelength_um - b.wavelength_um);
  const usedB = new Set<number>();
  const points: SedPoint[] = sortedA.map((sampleA) => {
    let bestIndex = -1;
    let bestDifference = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sortedB.length; index += 1) {
      if (usedB.has(index)) continue;
      const difference = Math.abs(
        sortedB[index].wavelength_um - sampleA.wavelength_um,
      );
      if (difference < bestDifference) {
        bestDifference = difference;
        bestIndex = index;
      }
    }
    const point: SedPoint = {
      wavelength_um: sampleA.wavelength_um,
      epochA: sampleA.flux_mjy_sr,
      sigmaA: sampleA.sigma_mjy_sr,
    };
    if (bestIndex < 0) return point;
    const sampleB = sortedB[bestIndex];
    const tolerance = Math.max(
      (sampleA.bandwidth_um + sampleB.bandwidth_um) / 2,
      0.005,
    );
    if (bestDifference <= tolerance) {
      usedB.add(bestIndex);
      point.wavelength_um =
        (sampleA.wavelength_um + sampleB.wavelength_um) / 2;
      point.epochB = sampleB.flux_mjy_sr;
      point.sigmaB = sampleB.sigma_mjy_sr;
    }
    return point;
  });

  sortedB.forEach((sample, index) => {
    if (!usedB.has(index)) {
      points.push({
        wavelength_um: sample.wavelength_um,
        epochB: sample.flux_mjy_sr,
        sigmaB: sample.sigma_mjy_sr,
      });
    }
  });
  return points.sort((a, b) => a.wavelength_um - b.wavelength_um);
}
