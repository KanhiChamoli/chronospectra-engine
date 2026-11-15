import { buildSedComparison } from "@/lib/sed";
import type { SpectrumSample } from "@/types/spectroscopy";

function spectralRegion(wavelengthUm: number): string {
  if (wavelengthUm >= 2.85 && wavelengthUm <= 3.15) {
    return "near the annotated H₂O-ice absorption region";
  }
  if (wavelengthUm >= 4.2 && wavelengthUm <= 4.34) {
    return "near the annotated CO₂-ice absorption region";
  }
  return `near ${wavelengthUm.toFixed(3)} μm`;
}

export function tellSpectrumStory(
  samplesA: SpectrumSample[],
  samplesB: SpectrumSample[],
  epochA: string,
  epochB: string,
  synthetic: boolean,
): string {
  if (epochA === epochB) {
    return "Choose two different observation epochs to summarize a spectral change.";
  }

  let strongest:
    | { wavelengthUm: number; difference: number; significance: number }
    | undefined;
  for (const point of buildSedComparison(samplesA, samplesB)) {
    if (
      point.epochA === undefined ||
      point.epochB === undefined ||
      point.sigmaA === undefined ||
      point.sigmaB === undefined
    ) {
      continue;
    }
    const difference = point.epochB - point.epochA;
    const uncertainty = Math.hypot(point.sigmaA, point.sigmaB);
    const candidate = {
      wavelengthUm: point.wavelength_um,
      difference,
      significance: uncertainty > 0 ? difference / uncertainty : 0,
    };
    if (
      Number.isFinite(candidate.significance) &&
      (!strongest ||
        Math.abs(candidate.significance) > Math.abs(strongest.significance))
    ) {
      strongest = candidate;
    }
  }

  if (!strongest) {
    return "There are not enough wavelength-matched measurements in these epochs to summarize a change.";
  }

  const direction = strongest.difference >= 0 ? "increased" : "decreased";
  const sourceLabel = synthetic ? "Demo signal" : "Screening note";
  return `${sourceLabel}: flux ${direction} ${Math.abs(strongest.significance).toFixed(1)}σ ${spectralRegion(strongest.wavelengthUm)} from ${epochA} to ${epochB}; this variance-based candidate needs inspection and does not establish a physical event.`;
}
