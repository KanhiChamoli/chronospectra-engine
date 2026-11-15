"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnomalyList } from "@/components/AnomalyList";
import { DualAxisMatrix } from "@/components/DualAxisMatrix";
import { SedModal } from "@/components/SedModal";
import { WorldWideTelescopeView } from "@/components/WorldWideTelescopeView";
import { getAnomalies, getDataStatus, getSpectrum } from "@/lib/api";
import type {
  Anomaly,
  AnomalyResponse,
  DataStatusResponse,
  SpectrumResponse,
} from "@/types/spectroscopy";

const hipsUrl =
  process.env.NEXT_PUBLIC_HIPS_BASE_URL ??
  "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube";

export default function ObservatoryPage() {
  const [anomalyResponse, setAnomalyResponse] = useState<AnomalyResponse | null>(null);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);
  const [dataStatus, setDataStatus] = useState<DataStatusResponse | null>(null);
  const [dataStatusError, setDataStatusError] = useState<string | null>(null);
  const [spectrum, setSpectrum] = useState<SpectrumResponse | null>(null);
  const [isSedOpen, setIsSedOpen] = useState(false);
  const [spectrumError, setSpectrumError] = useState<string | null>(null);
  const [loadingSpectrum, setLoadingSpectrum] = useState(false);
  const [epochA, setEpochA] = useState("");
  const [epochB, setEpochB] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [initialTarget, setInitialTarget] = useState<{ raDeg: number; decDeg: number } | null>(null);
  const spectrumRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getDataStatus(controller.signal)
      .then(setDataStatus)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDataStatusError(
            error instanceof Error ? error.message : "Could not check QR3 data readiness.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingAnomalies(true);
    setAnomalyError(null);
    setAnomalyResponse(null);
    void getAnomalies(controller.signal, epochA || undefined, epochB || undefined)
      .then(setAnomalyResponse)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setAnomalyError(error instanceof Error ? error.message : "Could not load anomalies.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAnomalies(false);
      });
    return () => controller.abort();
  }, [epochA, epochB]);

  const epochs = useMemo(
    () => Object.keys(spectrum?.epochs ?? {}).sort(),
    [spectrum],
  );
  const selectedSamples = useMemo(
    () => [...(spectrum?.epochs[epochA] ?? [])]
      .sort((a, b) => a.wavelength_um - b.wavelength_um),
    [epochA, spectrum],
  );
  const anomalies = anomalyResponse?.anomalies ?? [];

  const showSpectrum = useCallback(async (raDeg: number, decDeg: number) => {
    spectrumRequest.current?.abort();
    const controller = new AbortController();
    spectrumRequest.current = controller;
    setLoadingSpectrum(true);
    setSpectrumError(null);
    try {
      const result = await getSpectrum(raDeg, decDeg, controller.signal);
      if (controller.signal.aborted) return;
      setSpectrum(result);
      setIsSedOpen(true);
      const availableEpochs = Object.keys(result.epochs).sort();
      setEpochA(availableEpochs[0] ?? "");
      setEpochB(availableEpochs.at(-1) ?? "");
      setSelectedIndex(0);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSpectrum(null);
      setIsSedOpen(false);
      setSpectrumError(error instanceof Error ? error.message : "Spectrum extraction failed.");
    } finally {
      if (spectrumRequest.current === controller) {
        spectrumRequest.current = null;
        setLoadingSpectrum(false);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasRa = params.has("ra");
    const hasDec = params.has("dec");
    if (!hasRa && !hasDec) return;
    if (!hasRa || !hasDec) {
      setSpectrumError("Both ra and dec URL parameters are required.");
      return;
    }
    const raDeg = Number(params.get("ra"));
    const decDeg = Number(params.get("dec"));
    if (
      !Number.isFinite(raDeg) ||
      raDeg < 0 ||
      raDeg >= 360 ||
      !Number.isFinite(decDeg) ||
      decDeg < -90 ||
      decDeg > 90
    ) {
      setSpectrumError("Invalid sky coordinate in URL. Use RA 0–<360° and Dec −90–90°.");
      return;
    }
    const target = { raDeg, decDeg };
    setInitialTarget(target);
    void showSpectrum(raDeg, decDeg);
  }, [showSpectrum]);

  useEffect(() => () => spectrumRequest.current?.abort(), []);

  const updateCoordinateUrl = useCallback((raDeg: number, decDeg: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("ra", raDeg.toFixed(6));
    url.searchParams.set("dec", decDeg.toFixed(6));
    window.history.replaceState(null, "", url);
  }, []);

  const selectSkyPosition = useCallback((raDeg: number, decDeg: number) => {
    updateCoordinateUrl(raDeg, decDeg);
    void showSpectrum(raDeg, decDeg);
  }, [showSpectrum, updateCoordinateUrl]);

  const selectAnomaly = useCallback((anomaly: Anomaly) => {
    updateCoordinateUrl(anomaly.ra_deg, anomaly.dec_deg);
    void showSpectrum(anomaly.ra_deg, anomaly.dec_deg);
  }, [showSpectrum, updateCoordinateUrl]);

  return (
    <main className="observatory">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Chronospectra home">
          <span className="brand-mark">C</span>
          <span>CHRONO<span className="brand-accent">SPECTRA</span></span>
        </Link>
        <div className="mission-label">
          <span className="live-indicator" />
          SPHEREx · 102-BAND NEAR-INFRARED SURVEY
        </div>
        <a
          className="archive-link"
          href={hipsUrl}
          target="_blank"
          rel="noreferrer"
        >
          SPHEREx HiPS ↗
        </a>
      </header>

      <div className="workspace">
        <section className="sky-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ALL-SKY OBSERVATORY / ICRS</p>
              <h1>Temporal sky explorer</h1>
            </div>
            <span className="data-badge">QR3 SPECTRA · DR1 HiPS REFERENCE</span>
          </div>
          <WorldWideTelescopeView
            anomalies={anomalies}
            hipsBaseUrl={hipsUrl}
            initialTarget={initialTarget}
            onSkyClick={selectSkyPosition}
            onAnomalySelect={selectAnomaly}
          />
          {loadingSpectrum && <p className="inline-status">Extracting pixel samples from Zarr…</p>}
          {spectrumError && <p className="error-message inline-error">{spectrumError}</p>}
          {dataStatus && !dataStatus.ready && (
            <div className="data-readiness" role="status">
              <strong>QR3 pixel spectra are not staged on this API.</strong>
              <span>
                From the repository root, run{" "}
                <code>python backend\src\ingest_spherex.py</code> to download
                and index the challenge target cutouts. Then click a sky
                position again.
              </span>
            </div>
          )}
          {dataStatus && dataStatus.synthetic_product_count > 0 && (
            <div className="data-readiness demo-data" role="status">
              <strong>SYNTHETIC DEMO PRODUCTS — NOT NASA OBSERVATIONS</strong>
              <span>
                {dataStatus.synthetic_product_count} demo products are available for
                exercising spectra and anomaly comparisons. Replace them with verified
                QR3 products before scientific use.
              </span>
            </div>
          )}
          {dataStatusError && (
            <p className="error-message inline-error">
              QR3 readiness check failed: {dataStatusError}
            </p>
          )}
        </section>

        <aside className="analysis-rail">
          <DualAxisMatrix
            epochs={epochs}
            epochA={epochA}
            epochB={epochB}
            samplesByEpoch={spectrum?.epochs ?? {}}
            selectedIndex={selectedIndex}
            onEpochAChange={(epoch) => {
              setEpochA(epoch);
              setSelectedIndex(0);
            }}
            onEpochBChange={setEpochB}
            onOpenSed={() => setIsSedOpen(true)}
            onCellSelect={(epoch, wavelengthUm) => {
              const samples = [...(spectrum?.epochs[epoch] ?? [])]
                .sort((a, b) => a.wavelength_um - b.wavelength_um);
              const index = samples.reduce((bestIndex, sample, currentIndex) =>
                Math.abs(sample.wavelength_um - wavelengthUm) <
                Math.abs(samples[bestIndex]?.wavelength_um - wavelengthUm)
                  ? currentIndex
                  : bestIndex,
              0);
              if (epoch !== epochA) setEpochB(epoch);
              setSelectedIndex(index);
            }}
          />
          <AnomalyList
            anomalies={anomalies}
            dataReady={dataStatus?.ready ?? null}
            loading={loadingAnomalies}
            error={anomalyError}
            onSelect={selectAnomaly}
          />
          <p className="science-note">
            <strong>Data note</strong>
            IRSA’s official HiPS layer is DR1 and visualization-oriented. QR3
            pixel samples are separate, detector-level measurements; a spectrum
            may contain fewer than 102 usable channels.
          </p>
        </aside>
      </div>

      {spectrum && isSedOpen && (
        <SedModal
          spectrum={spectrum}
          epochA={epochA}
          epochB={epochB}
          selectedWavelength={selectedSamples[selectedIndex]?.wavelength_um ?? null}
          onClose={() => setIsSedOpen(false)}
        />
      )}
    </main>
  );
}
