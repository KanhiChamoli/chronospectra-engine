"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Sparkles, Share2, HelpCircle } from "lucide-react";
import { WorldWideTelescopeView } from "@/components/WorldWideTelescopeView";
import { EpochComparator } from "@/components/EpochComparator";
import { InspectorPanel } from "@/components/InspectorPanel";
import { BottomPlotDock } from "@/components/BottomPlotDock";
import { GuidedTour } from "@/components/GuidedTour";
import { DualAxisMatrix } from "@/components/DualAxisMatrix";
import { SedModal } from "@/components/SedModal";
import { AnomalyList } from "@/components/AnomalyList";


import { getAnomalies, getDataStatus, getSpectrum } from "@/lib/api";
import { searchCelestialTargets, type CelestialTarget } from "@/lib/celestialCatalog";
import { challengePresets, getPresetById } from "@/lib/challengePresets";
import {
  generateCutoutFrames,
  generatePhotometry,
  generateGaiaSources,
  generateCandidates,
  generateAsteroidMatches,
  defaultEpochs,
  defaultCommunityFinds,
} from "@/lib/syntheticData";
import type { AnomalyResponse, DataStatusResponse, SpectrumResponse } from "@/types/spectroscopy";
import type { ChallengePreset, TargetPhotometry, CandidateSource, GaiaSource, AsteroidMatch, EpochVisit, CutoutFrame } from "@/types/cutout";
import { defaultViewportSettings, type ViewportSettings } from "@/types/viewport";

const hipsUrl = process.env.NEXT_PUBLIC_HIPS_BASE_URL ?? "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube";

type MainView = "sky" | "cutout" | "plots";

interface LocalObservation {
  id: string;
  name: string;
  ra: number;
  dec: number;
  notes: string;
  savedAt: string;
  presetId?: string;
  tags?: string[];
}

function ObservatoryInner() {
  const searchParams = useSearchParams();

  // Core state
  const [mainView, setMainView] = useState<MainView>("sky");
  const [activePreset, setActivePreset] = useState<ChallengePreset | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{ ra: number; dec: number; name: string; id: string } | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  // Synthetic/cutout data
  const [cutoutEpochs, setCutoutEpochs] = useState<EpochVisit[]>(defaultEpochs);
  const [cutoutFrames, setCutoutFrames] = useState<Record<string, CutoutFrame>>({});
  const [frameSize, setFrameSize] = useState({ w: 64, h: 64 });
  const [photometry, setPhotometry] = useState<TargetPhotometry | null>(null);
  const [gaiaSources, setGaiaSources] = useState<GaiaSource[]>([]);
  const [candidates, setCandidates] = useState<CandidateSource[]>([]);
  const [asteroidMatches, setAsteroidMatches] = useState<AsteroidMatch[]>([]);
  const [currentEpochId, setCurrentEpochId] = useState(defaultEpochs[3]?.id ?? "2026-05");
  const [pixelInfo, setPixelInfo] = useState<{ x: number; y: number; ra: number; dec: number; flux: number } | null>(null);

  // Existing state
  const [anomalyResponse, setAnomalyResponse] = useState<AnomalyResponse | null>(null);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);
  const [dataStatus, setDataStatus] = useState<DataStatusResponse | null>(null);
  const [spectrum, setSpectrum] = useState<SpectrumResponse | null>(null);
  const [isSedOpen, setIsSedOpen] = useState(false);
  const [spectrumError, setSpectrumError] = useState<string | null>(null);
  const [loadingSpectrum, setLoadingSpectrum] = useState(false);
  const [epochA, setEpochA] = useState("");
  const [epochB, setEpochB] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [initialTarget, setInitialTarget] = useState<{ raDeg: number; decDeg: number } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<CelestialTarget | null>(null);
  const [objectActionStatus, setObjectActionStatus] = useState("");
  const [viewportSettings] = useState<ViewportSettings>(defaultViewportSettings);
  const [, setFieldOfView] = useState(0);
  const [nightMode] = useState(false);
  const [location] = useState<{ latitude: number; longitude: number; label: string } | null>(null);


  // Local observations (no login required)
  const [localObs, setLocalObs] = useState<LocalObservation[]>([]);
  const spectrumRequest = useRef<AbortController | null>(null);

  // Load local observations + seed community finds
  useEffect(() => {
    try {
      const stored = localStorage.getItem("chronospectra-observations");
      const userObs: LocalObservation[] = stored ? JSON.parse(stored) : [];
      const seeded: LocalObservation[] = defaultCommunityFinds.map((f) => ({
        id: f.id, name: f.name, ra: f.ra, dec: f.dec, notes: f.description, savedAt: "2026-01-01T00:00:00Z", tags: f.tags,
      }));
      // Merge: seeded first, then user obs not in seeded
      const merged = [...seeded];
      userObs.forEach((o) => { if (!merged.find((m) => m.id === o.id)) merged.push(o); });
      setLocalObs(merged);
    } catch { setLocalObs(defaultCommunityFinds.map((f) => ({ id: f.id, name: f.name, ra: f.ra, dec: f.dec, notes: f.description, savedAt: "2026-01-01T00:00:00Z", tags: f.tags }))); }
  }, []);

  const saveLocalObs = useCallback((obs: LocalObservation[]) => {
    setLocalObs(obs);
    try {
      const userOnly = obs.filter((o) => !o.id.startsWith("cs-"));
      localStorage.setItem("chronospectra-observations", JSON.stringify(userOnly));
    } catch {}
  }, []);

  // Load preset data
  const loadPreset = useCallback((preset: ChallengePreset) => {
    setActivePreset(preset);
    setSelectedTarget({ ra: preset.ra, dec: preset.dec, name: preset.name, id: preset.id });
    setInitialTarget({ raDeg: preset.ra, decDeg: preset.dec });
    setMainView("cutout");
    const { epochs, frames, width, height } = generateCutoutFrames(preset);
    setCutoutEpochs(epochs);
    setCutoutFrames(frames);
    setFrameSize({ w: width, h: height });
    setPhotometry(generatePhotometry(preset));
    setGaiaSources(generateGaiaSources(preset));
    setCandidates(generateCandidates(preset));
    setAsteroidMatches(generateAsteroidMatches(preset));
    setCurrentEpochId(epochs[3]?.id ?? epochs[0]?.id);
    setPixelInfo(null);
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set("target", preset.id);
    url.searchParams.set("view", "cutout");
    window.history.replaceState(null, "", url);
  }, []);

  // Handle URL params on load
  useEffect(() => {
    const targetId = searchParams.get("target");
    const view = searchParams.get("view") as MainView | null;
    if (targetId) {
      const preset = getPresetById(targetId);
      if (preset) {
        loadPreset(preset);
        if (view === "sky" || view === "plots") setMainView(view);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Data status
  useEffect(() => {
    const controller = new AbortController();
    void getDataStatus(controller.signal).then(setDataStatus).catch(() => {});
    return () => controller.abort();
  }, []);

  // Anomalies
  useEffect(() => {
    const controller = new AbortController();
    setLoadingAnomalies(true);
    void getAnomalies(controller.signal, epochA || undefined, epochB || undefined)
      .then(setAnomalyResponse).catch((e) => { if (!controller.signal.aborted) setAnomalyError(e instanceof Error ? e.message : "Failed"); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAnomalies(false); });
    return () => controller.abort();
  }, [epochA, epochB]);

  const anomalies = useMemo(() => anomalyResponse?.anomalies ?? [], [anomalyResponse]);
  const epochs = useMemo(() => Object.keys(spectrum?.epochs ?? {}).sort(), [spectrum]);
  const selectedSamples = useMemo(() => [...(spectrum?.epochs[epochA] ?? [])].sort((a, b) => a.wavelength_um - b.wavelength_um), [epochA, spectrum]);

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
      const ae = Object.keys(result.epochs).sort();
      setEpochA(ae[0] ?? ""); setEpochB(ae.at(-1) ?? ""); setSelectedIndex(0);
    } catch (error) {
      if (!controller.signal.aborted) { setSpectrum(null); setSpectrumError(error instanceof Error ? error.message : "Spectrum extraction failed."); }
    } finally { if (spectrumRequest.current === controller) { spectrumRequest.current = null; setLoadingSpectrum(false); } }
  }, []);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => { setShareMsg("Link copied!"); setTimeout(() => setShareMsg(""), 2000); }).catch(() => { setShareMsg("Copy failed"); setTimeout(() => setShareMsg(""), 2000); });
  }, []);

  const handleExportPacket = useCallback(() => {
    if (!activePreset || !photometry) return;
    const packet = {
      target: { name: activePreset.name, ra: activePreset.ra, dec: activePreset.dec, id: activePreset.id },
      fov: "8'",
      epochs: cutoutEpochs.map((e) => ({ label: e.label, mjd: e.mjd, date: e.date })),
      gaiaCrossMatch: candidates[0] ? { worstOffsetArcsec: candidates[0].worstOffsetArcsec, worstOffsetPx: candidates[0].worstOffsetPx, matched: candidates[0].gaiaMatch, perVisit: candidates[0].perVisitOffsets } : null,
      solarSystemClearance: { clear: asteroidMatches.length === 0, matches: asteroidMatches },
      properMotion: candidates[0]?.properMotion ? { pmArcsecYr: candidates[0].properMotion, pa: candidates[0].properMotionPA, uncertainty: candidates[0].properMotionUncertainty } : null,
      photometry: photometry.lightCurve,
      spectrumR40: photometry.spectraByVisit[photometry.visits[0]]?.binnedR40 ?? [],
      shareUrl: window.location.href,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `discovery-packet-${activePreset.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setObjectActionStatus("Discovery packet exported.");
    setTimeout(() => setObjectActionStatus(""), 3000);
  }, [activePreset, photometry, cutoutEpochs, candidates, asteroidMatches]);

  const saveObservation = useCallback(() => {
    const target = selectedTarget ?? (activePreset ? { ra: activePreset.ra, dec: activePreset.dec, name: activePreset.name, id: activePreset.id } : null);
    if (!target) return;
    const obs: LocalObservation = {
      id: `obs-${Date.now()}`, name: target.name, ra: target.ra, dec: target.dec,
      notes: "", savedAt: new Date().toISOString(), presetId: activePreset?.id,
    };
    saveLocalObs([...localObs, obs]);
    setObjectActionStatus("Saved to My Observations.");
    setTimeout(() => setObjectActionStatus(""), 2000);
  }, [selectedTarget, activePreset, localObs, saveLocalObs]);

  const searchResults = useMemo(() => searchCelestialTargets(searchText), [searchText]);
  const matchingPresets = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    return challengePresets.filter((p) => p.name.toLowerCase().includes(q) || p.shortLabel.toLowerCase().includes(q));
  }, [searchText]);

  const selectTarget = useCallback((target: CelestialTarget) => {
    setSelectedObject(target);
    setSelectedTarget({ ra: target.raDeg, dec: target.decDeg, name: target.name, id: target.id });
    setInitialTarget({ raDeg: target.raDeg, decDeg: target.decDeg });
    setSearchText(""); setSearchOpen(false);
    // Check if it's a preset
    const preset = challengePresets.find((p) => p.id === target.id);
    if (preset) { loadPreset(preset); return; }
    void showSpectrum(target.raDeg, target.decDeg);
  }, [showSpectrum, loadPreset]);

  const selectSkyPosition = useCallback((raDeg: number, decDeg: number) => {
    setSelectedTarget({ ra: raDeg, dec: decDeg, name: "Sky position", id: `sky-${raDeg.toFixed(4)}` });
    void showSpectrum(raDeg, decDeg);
  }, [showSpectrum]);

  const currentEpoch = cutoutEpochs.find((e) => e.id === currentEpochId) ?? null;

  return (
    <main className="observatory" data-night-mode={nightMode}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Chronospectra home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.5" /><path d="M2.5 15.5C7 6.5 15 4 21.5 9" /><path d="m18.7 6.7 2.8 2.4-3.5.7" /><circle className="brand-star" cx="12" cy="12" r="1.5" /></svg>
          </span>
          <span>CHRONO<span className="brand-accent">SPECTRA</span></span>
        </Link>

        <form className="sky-search" role="search" onSubmit={(e) => { e.preventDefault(); if (matchingPresets[0]) loadPreset(matchingPresets[0]); else if (searchResults[0]) selectTarget(searchResults[0]); }}>
          <label className="sr-only" htmlFor="celestial-search">Search</label>
          <span aria-hidden="true"><Search size={16} /></span>
          <input id="celestial-search" value={searchText} onFocus={() => setSearchOpen(true)}
            onChange={(e) => { setSearchText(e.target.value); setSearchOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
            placeholder="Search presets, stars, coordinates…" autoComplete="off" />
          {searchOpen && searchText.trim() && (
            <div className="search-results" role="listbox">
              {matchingPresets.map((p) => (
                <button type="button" key={p.id} onClick={() => { loadPreset(p); setSearchOpen(false); setSearchText(""); }}>
                  <span className="search-result-symbol" aria-hidden="true"><Sparkles size={14} /></span>
                  <span><strong>{p.name}</strong><small>{p.category} · Preset</small></span>
                </button>
              ))}
              {searchResults.map((t) => (
                <button type="button" key={t.id} onClick={() => selectTarget(t)}>
                  <span className="search-result-symbol" aria-hidden="true"><Sparkles size={14} /></span>
                  <span><strong>{t.name}</strong><small>{t.category}</small></span>
                </button>
              ))}
              {matchingPresets.length === 0 && searchResults.length === 0 && <p className="search-no-results">No matches. Try a preset name or coordinates.</p>}
            </div>
          )}
        </form>

        <div className="topbar-actions">
          <button className="topbar-btn tour-btn-header" onClick={() => setTourOpen(true)} title="Guided Tour"><HelpCircle size={16} /> Tour</button>
          <button className="topbar-btn share-btn-header" onClick={handleShare} title="Share"><Share2 size={16} /> {shareMsg || "Share"}</button>
        </div>
      </header>

      {/* Preset Bar */}
      <div className="preset-bar">
        <span className="preset-label">Presets:</span>
        {challengePresets.map((p) => (
          <button key={p.id} className={`preset-chip${activePreset?.id === p.id ? " active" : ""}`} onClick={() => loadPreset(p)} title={p.description}>
            {p.shortLabel}
          </button>
        ))}
        <span className="preset-hint">1-click NASA challenge targets · instant load</span>
      </div>

      {/* View Toggle */}
      <div className="view-toggle-bar">
        <button className={`view-toggle-btn${mainView === "sky" ? " active" : ""}`} onClick={() => setMainView("sky")}>All-Sky WWT</button>
        <button className={`view-toggle-btn${mainView === "cutout" ? " active" : ""}`} onClick={() => setMainView("cutout")}>8′ Cutout Inspector</button>
        <button className={`view-toggle-btn${mainView === "plots" ? " active" : ""}`} onClick={() => setMainView("plots")}>Light Curve & SED Plots</button>
      </div>

      <div className={`workspace ${mainView === "cutout" ? "cutout-layout" : ""}`}>
        <section className="sky-section">
          {mainView === "sky" && (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">ALL-SKY OBSERVATORY / ICRS</p><h1>Temporal sky explorer</h1></div>
                <span className="data-badge">QR3 DATA STATUS · DR1 HiPS</span>
              </div>
              <WorldWideTelescopeView
                anomalies={anomalies} hipsBaseUrl={hipsUrl} initialTarget={initialTarget}
                viewportSettings={viewportSettings} observerLongitude={location?.longitude ?? null}
                selectedTargetId={selectedObject?.id ?? null} onFieldOfViewChange={setFieldOfView}
                onSkyClick={selectSkyPosition} onAnomalySelect={(a) => { setSelectedTarget({ ra: a.ra_deg, dec: a.dec_deg, name: a.target_name, id: a.target_id }); void showSpectrum(a.ra_deg, a.dec_deg); }}
                onTargetSelect={selectTarget}
              />
            </>
          )}

          {mainView === "cutout" && activePreset && (
            <div className="cutout-main">
              <div className="section-heading">
                <div><p className="eyebrow">8′ CUTOUT INSPECTOR · MULTI-EPOCH</p><h1>{activePreset.name}</h1></div>
                <span className="data-badge">{cutoutEpochs.length} visits · {activePreset.category}</span>
              </div>
              <EpochComparator
                preset={activePreset} epochs={cutoutEpochs} frames={cutoutFrames}
                frameWidth={frameSize.w} frameHeight={frameSize.h}
                gaiaSources={gaiaSources} candidates={candidates}
                onEpochChange={setCurrentEpochId} onPixelHover={setPixelInfo}
              />
              <p className="cutout-preset-desc">{activePreset.description}</p>
            </div>
          )}

          {mainView === "cutout" && !activePreset && (
            <div className="cutout-empty">
              <h2>Select a preset to begin</h2>
              <p>Choose a challenge preset from the bar above to load multi-epoch cutout data, or search for a target.</p>
              <div className="preset-grid">
                {challengePresets.map((p) => (
                  <button key={p.id} className="preset-card" onClick={() => loadPreset(p)}>
                    <strong>{p.name}</strong>
                    <span>{p.category}</span>
                    <small>{p.watchFor}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mainView === "plots" && (
            <div className="plots-main">
              <div className="section-heading">
                <div><p className="eyebrow">LIGHT CURVE & 102-CHANNEL SPECTRUM</p><h1>{activePreset?.name ?? "Select a target"}</h1></div>
              </div>
              {photometry ? (
                <BottomPlotDock photometry={photometry} selectedEpoch={currentEpochId} onEpochSelect={setCurrentEpochId} />
              ) : (
                <p className="chart-empty">Select a preset to view photometry and spectral plots.</p>
              )}
            </div>
          )}

          {objectActionStatus && <p className="object-action-status" role="status">{objectActionStatus}</p>}
          {loadingSpectrum && <p className="inline-status">Extracting pixel samples from Zarr…</p>}
          {spectrumError && mainView === "sky" && <p className="error-message inline-error">{spectrumError}</p>}
          {dataStatus && dataStatus.synthetic_product_count > 0 && mainView === "sky" && (
            <div className="data-readiness demo-data" role="status">
              <strong>DEMO MODE · {dataStatus.synthetic_product_count.toLocaleString()} SYNTHETIC PRODUCTS</strong>
              <span> These generated samples exercise the interface; they are not NASA/SPHEREx observations.</span>
            </div>
          )}
        </section>

        <aside className="analysis-rail">
          {mainView === "cutout" && activePreset ? (
            <InspectorPanel
              preset={activePreset} currentEpoch={currentEpoch} pixelInfo={pixelInfo}
              candidates={candidates} asteroidMatches={asteroidMatches}
              onExportPacket={handleExportPacket} onShare={handleShare}
            />
          ) : (
            <>
              <DualAxisMatrix
                epochs={epochs} epochA={epochA} epochB={epochB}
                samplesByEpoch={spectrum?.epochs ?? {}} selectedIndex={selectedIndex}
                onEpochAChange={(e) => { setEpochA(e); setSelectedIndex(0); }}
                onEpochBChange={setEpochB} onOpenSed={() => setIsSedOpen(true)}
                onCellSelect={(epoch, wavelengthUm) => {
                  const samples = [...(spectrum?.epochs[epoch] ?? [])].sort((a, b) => a.wavelength_um - b.wavelength_um);
                  const index = samples.reduce((best, s, i) => Math.abs(s.wavelength_um - wavelengthUm) < Math.abs(samples[best]?.wavelength_um - wavelengthUm) ? i : best, 0);
                  if (epoch !== epochA) setEpochB(epoch);
                  setSelectedIndex(index);
                }}
              />
              <AnomalyList anomalies={anomalies} dataReady={dataStatus?.ready ?? null} loading={loadingAnomalies} error={anomalyError} onSelect={(a) => { loadPreset(challengePresets.find(p => p.ra === a.ra_deg) ?? challengePresets[0]); }} />
            </>
          )}

          <div className="observations-drawer">
            <h4>My Observations ({localObs.length})</h4>
            <button className="action-btn small" onClick={saveObservation}>+ Save Current Target</button>
            <div className="obs-list">
              {localObs.slice(0, 10).map((obs) => (
                <button key={obs.id} className="obs-item" onClick={() => {
                  const preset = challengePresets.find((p) => p.id === obs.presetId);
                  if (preset) loadPreset(preset);
                  else { setSelectedTarget({ ra: obs.ra, dec: obs.dec, name: obs.name, id: obs.id }); setInitialTarget({ raDeg: obs.ra, decDeg: obs.dec }); }
                }}>
                  <strong>{obs.name}</strong>
                  <small>{obs.tags?.join(", ") || `${obs.ra.toFixed(2)}°, ${obs.dec.toFixed(2)}°`}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Plot Dock - always available in cutout view */}
      {mainView === "cutout" && photometry && (
        <BottomPlotDock photometry={photometry} selectedEpoch={currentEpochId} onEpochSelect={(ep) => { setCurrentEpochId(cutoutEpochs.findIndex((e) => e.id === ep) >= 0 ? ep : currentEpochId); }} />
      )}

      <GuidedTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      {spectrum && isSedOpen && (
        <SedModal spectrum={spectrum} epochA={epochA} epochB={epochB} selectedWavelength={selectedSamples[selectedIndex]?.wavelength_um ?? null} onClose={() => setIsSedOpen(false)} />
      )}
    </main>
  );
}

export default function ObservatoryPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Loading Chrono Spectra Observatory…</div>}>
      <ObservatoryInner />
    </Suspense>
  );
}
