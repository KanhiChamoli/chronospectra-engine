import type {
  AnomalyResponse,
  DataStatusResponse,
  SpectrumResponse,
} from "@/types/spectroscopy";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the Chronospectra API at ${apiBaseUrl}. Start FastAPI and verify NEXT_PUBLIC_API_BASE_URL.`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function getSpectrum(
  raDeg: number,
  decDeg: number,
  signal?: AbortSignal,
): Promise<SpectrumResponse> {
  const params = new URLSearchParams({
    ra_deg: raDeg.toString(),
    dec_deg: decDeg.toString(),
    radius_arcsec: "30",
  });
  return getJson<SpectrumResponse>(`/api/v1/spectra?${params}`, signal);
}

export function getAnomalies(
  signal?: AbortSignal,
  epochA?: string,
  epochB?: string,
): Promise<AnomalyResponse> {
  const params = new URLSearchParams({ min_significance: "5" });
  if (epochA) params.set("epoch_a", epochA);
  if (epochB) params.set("epoch_b", epochB);
  return getJson<AnomalyResponse>(`/api/v1/anomalies?${params}`, signal);
}

export function getDataStatus(
  signal?: AbortSignal,
): Promise<DataStatusResponse> {
  return getJson<DataStatusResponse>("/api/v1/data-status", signal);
}
