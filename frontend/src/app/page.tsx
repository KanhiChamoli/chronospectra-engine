"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { AnomalyList } from "@/components/AnomalyList";
import { AuthDialog } from "@/components/AuthDialog";
import { DualAxisMatrix } from "@/components/DualAxisMatrix";
import { ObjectDetailPanel } from "@/components/ObjectDetailPanel";
import { ObservationSidebar } from "@/components/ObservationSidebar";
import { SedModal } from "@/components/SedModal";
import { ViewportToolbar } from "@/components/ViewportToolbar";
import { WorldWideTelescopeView } from "@/components/WorldWideTelescopeView";
import { getAnomalies, getDataStatus, getSpectrum } from "@/lib/api";
import {
  createObservation,
  deleteAccount,
  deleteObservation,
  getCurrentUser,
  getObservations,
  signOut,
  updateObservationNotes,
} from "@/lib/auth";
import { celestialCatalog, searchCelestialTargets, type CelestialTarget } from "@/lib/celestialCatalog";
import type {
  Anomaly,
  AnomalyResponse,
  DataStatusResponse,
  SpectrumResponse,
} from "@/types/spectroscopy";
import type { AuthUser, Observation } from "@/types/auth";
import { defaultViewportSettings, type ViewportSettings } from "@/types/viewport";

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observationsLoading, setObservationsLoading] = useState(false);
  const [observationsError, setObservationsError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<CelestialTarget | null>(null);
  const [objectActionStatus, setObjectActionStatus] = useState("");
  const [viewportSettings, setViewportSettings] = useState<ViewportSettings>(defaultViewportSettings);
  const [fieldOfView, setFieldOfView] = useState(0);
  const [nightMode, setNightMode] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [locationStatus, setLocationStatus] = useState("Requesting location permission…");
  const [sidebarError, setSidebarError] = useState("");
  const spectrumRequest = useRef<AbortController | null>(null);
  const pendingSave = useRef<CelestialTarget | null>(null);

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
    let active = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setObservations([]);
      setObservationsLoading(false);
      return;
    }
    let active = true;
    setObservationsLoading(true);
    setObservationsError("");
    void getObservations()
      .then((items) => {
        if (active) setObservations(items);
      })
      .catch((error: unknown) => {
        if (active) setObservationsError(error instanceof Error ? error.message : "Could not load your observations.");
      })
      .finally(() => {
        if (active) setObservationsLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = coords.latitude;
        const longitude = coords.longitude;
        setLocation({
          latitude,
          longitude,
          label: `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`,
        });
        setLocationStatus("");
      },
      () => setLocationStatus("Location unavailable · allow location access"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
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
  const anomalies = useMemo(
    () => anomalyResponse?.anomalies ?? [],
    [anomalyResponse],
  );

  const updateCoordinateUrl = useCallback((raDeg: number, decDeg: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("ra", raDeg.toFixed(6));
    url.searchParams.set("dec", decDeg.toFixed(6));
    window.history.replaceState(null, "", url);
  }, []);

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
    setSelectedObject({
      id: `url-${raDeg.toFixed(4)}-${decDeg.toFixed(4)}`,
      name: "Shared sky position",
      category: "ICRS coordinate link",
      aliases: [],
      raDeg,
      decDeg,
      summary: "A coordinate shared in the URL. Object identification depends on available catalog data.",
      source: "Coordinate deep link",
    });
    void showSpectrum(raDeg, decDeg);
  }, [showSpectrum]);

  useEffect(() => () => spectrumRequest.current?.abort(), []);

  const selectTarget = useCallback((target: CelestialTarget) => {
    setSelectedObject(target);
    setInitialTarget({ raDeg: target.raDeg, decDeg: target.decDeg });
    updateCoordinateUrl(target.raDeg, target.decDeg);
    setSearchText("");
    setSearchOpen(false);
    setObjectActionStatus("");
  }, [updateCoordinateUrl]);

  const selectSkyPosition = useCallback((raDeg: number, decDeg: number) => {
    updateCoordinateUrl(raDeg, decDeg);
    const nearest = celestialCatalog.find((target) => {
      const dra = (target.raDeg - raDeg) * Math.cos(decDeg * Math.PI / 180);
      const ddec = target.decDeg - decDeg;
      return Math.hypot(dra, ddec) < 0.1;
    });
    setSelectedObject(nearest ?? {
      id: `sky-${raDeg.toFixed(4)}-${decDeg.toFixed(4)}`,
      name: "Sky position",
      category: "ICRS coordinate",
      aliases: [],
      raDeg,
      decDeg,
      summary: "A coordinate selected in the sky viewer. Available science products are queried separately; no object identification is implied.",
      source: "WWT sky selection",
    });
    setObjectActionStatus("");
    void showSpectrum(raDeg, decDeg);
  }, [showSpectrum, updateCoordinateUrl]);

  const selectAnomaly = useCallback((anomaly: Anomaly) => {
    setSearchText("");
    setSearchOpen(false);
    updateCoordinateUrl(anomaly.ra_deg, anomaly.dec_deg);
    const knownTarget = celestialCatalog.find((target) => target.id === anomaly.target_id);
    setSelectedObject(knownTarget ?? {
      id: `anomaly-${anomaly.target_id}`,
      name: anomaly.target_name,
      category: "Differential screening candidate",
      aliases: [anomaly.target_id],
      raDeg: anomaly.ra_deg,
      decDeg: anomaly.dec_deg,
      summary: anomaly.narrative,
      source: "Chronospectra epoch comparison",
    });
    setInitialTarget({ raDeg: anomaly.ra_deg, decDeg: anomaly.dec_deg });
    void showSpectrum(anomaly.ra_deg, anomaly.dec_deg);
  }, [showSpectrum, updateCoordinateUrl]);

  const viewSelectedSpectrum = useCallback(() => {
    if (selectedObject) void showSpectrum(selectedObject.raDeg, selectedObject.decDeg);
  }, [selectedObject, showSpectrum]);

  const saveTarget = useCallback(async (target: CelestialTarget) => {
    setObjectActionStatus("Saving observation…");
    try {
      const saved = await createObservation({
        ra_deg: target.raDeg,
        dec_deg: target.decDeg,
        target_name: target.name,
        source: "sky-view",
      });
      setObservations((current) => [saved, ...current]);
      setObjectActionStatus("Saved to My Observations.");
    } catch (error) {
      setObjectActionStatus(error instanceof Error ? error.message : "Could not save this observation.");
    }
  }, []);

  const saveSelectedObject = useCallback(async () => {
    if (!selectedObject) return;
    if (!user) {
      pendingSave.current = selectedObject;
      setAuthOpen(true);
      setObjectActionStatus("Sign in to save this target to your private observations.");
      return;
    }
    await saveTarget(selectedObject);
  }, [saveTarget, selectedObject, user]);

  const openObservation = useCallback((observation: Observation) => {
    const knownTarget = celestialCatalog.find(
      (target) => Math.abs(target.raDeg - observation.ra_deg) < 0.01 &&
        Math.abs(target.decDeg - observation.dec_deg) < 0.01,
    );
    selectTarget(knownTarget ?? {
      id: `observation-${observation.id}`,
      name: observation.target_name,
      category: "Saved observation",
      aliases: [],
      raDeg: observation.ra_deg,
      decDeg: observation.dec_deg,
      summary: observation.notes || "A target saved in your private observation logbook.",
      source: "My Observations",
    });
  }, [selectTarget]);

  const handleFullscreen = useCallback(() => {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    void action.catch((error: unknown) => {
      setObjectActionStatus(error instanceof Error ? `Fullscreen unavailable: ${error.message}` : "Fullscreen unavailable.");
    });
  }, []);

  const searchResults = useMemo(
    () => searchCelestialTargets(searchText),
    [searchText],
  );
  const matchingAnomalies = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return [];
    return anomalies
      .filter((anomaly) => anomaly.target_name.toLocaleLowerCase().includes(query))
      .slice(0, 4);
  }, [anomalies, searchText]);

  return (
    <main className="observatory" data-night-mode={nightMode}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Chronospectra home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="7.5" />
              <path d="M2.5 15.5C7 6.5 15 4 21.5 9" />
              <path d="m18.7 6.7 2.8 2.4-3.5.7" />
              <circle className="brand-star" cx="12" cy="12" r="1.5" />
            </svg>
          </span>
          <span>CHRONO<span className="brand-accent">SPECTRA</span></span>
        </Link>
        <form
          className="sky-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (searchResults[0]) {
              selectTarget(searchResults[0]);
            } else if (matchingAnomalies[0]) {
              selectAnomaly(matchingAnomalies[0]);
            }
          }}
        >
          <label className="sr-only" htmlFor="celestial-search">Search celestial objects</label>
          <span aria-hidden="true"><Search size={16} /></span>
          <input
            id="celestial-search"
            value={searchText}
            onFocus={() => setSearchOpen(true)}
            role="combobox"
            aria-expanded={searchOpen && Boolean(searchText.trim())}
            aria-controls="celestial-search-results"
            aria-autocomplete="list"
            onChange={(event) => {
              setSearchText(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Search stars, planets, and challenge targets…"
            autoComplete="off"
          />
          {searchOpen && searchText.trim() && (
            <div id="celestial-search-results" className="search-results" role="listbox" aria-label="Celestial search results">
              {searchResults.map((target) => (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  key={target.id}
                  onClick={() => selectTarget(target)}
                >
                  <span className="search-result-symbol" aria-hidden="true"><Sparkles size={16} /></span>
                  <span><strong>{target.name}</strong><small>{target.category} · {target.aliases[0] ?? "ICRS catalog target"}</small></span>
                </button>
              ))}
              {matchingAnomalies.map((anomaly) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={`anomaly-${anomaly.target_id}`}
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchText("");
                      selectAnomaly(anomaly);
                    }}
                  >
                    <span className="search-result-symbol anomaly-symbol" aria-hidden="true">◉</span>
                    <span><strong>{anomaly.target_name}</strong><small>Anomaly candidate · {Math.abs(anomaly.significance).toFixed(1)}σ</small></span>
                  </button>
                ))}
              {searchResults.length === 0 && matchingAnomalies.length === 0 && (
                <p className="search-no-results">No matching catalog entry. Search the listed stars and SPHEREx targets.</p>
              )}
            </div>
          )}
        </form>
        <a
          className="archive-link"
          href={hipsUrl}
          target="_blank"
          rel="noreferrer"
        >
          SPHEREx HiPS ↗
        </a>
        <button type="button" className="account-button" onClick={() => setAuthOpen(true)}>
          {user ? user.full_name.split(" ")[0] : "Sign in"}
        </button>
      </header>

      <ObservationSidebar
        user={user}
        observations={observations}
        open={sidebarOpen}
        loading={observationsLoading}
        error={observationsError}
        onToggle={() => setSidebarOpen((open) => !open)}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={() => {
          void signOut()
            .then(() => setUser(null))
            .catch((error: unknown) => setSidebarError(error instanceof Error ? error.message : "Could not sign out."));
        }}
        onDeleteAccount={() => {
          void deleteAccount()
            .then(() => {
              setUser(null);
              setObservations([]);
              setObjectActionStatus("Account and saved observations deleted.");
            })
            .catch((error: unknown) => setSidebarError(error instanceof Error ? error.message : "Could not delete the account."));
        }}
        onOpenObservation={openObservation}
        onDeleteObservation={(id) => {
          void deleteObservation(id)
            .then(() => setObservations((items) => items.filter((item) => item.id !== id)))
            .catch((error: unknown) => setSidebarError(error instanceof Error ? error.message : "Could not remove observation."));
        }}
        onUpdateNotes={(id, notes) => {
          void updateObservationNotes(id, notes)
            .then((updated) => setObservations((items) => items.map((item) => item.id === id ? updated : item)))
            .catch((error: unknown) => setSidebarError(error instanceof Error ? error.message : "Could not update observation."));
        }}
      />

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
            viewportSettings={viewportSettings}
            observerLongitude={location?.longitude ?? null}
            selectedTargetId={selectedObject?.id ?? null}
            onFieldOfViewChange={setFieldOfView}
            onSkyClick={selectSkyPosition}
            onAnomalySelect={selectAnomaly}
            onTargetSelect={selectTarget}
          />
          {selectedObject && (
            <ObjectDetailPanel
              target={selectedObject}
              latitude={location?.latitude ?? null}
              longitude={location?.longitude ?? null}
              onClose={() => setSelectedObject(null)}
              onSave={() => void saveSelectedObject()}
              onViewSpectrum={viewSelectedSpectrum}
            />
          )}
          {objectActionStatus && <p className="object-action-status" role="status">{objectActionStatus}</p>}
          {sidebarError && <p className="object-action-status error-message" role="alert">{sidebarError}</p>}
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
              <strong>
                DEMO MODE · {dataStatus.synthetic_product_count.toLocaleString()} SYNTHETIC PRODUCTS
              </strong>
              <span>
                These generated samples exercise the interface; they are not NASA/SPHEREx
                observations and are not scientific evidence. Explore the challenge&apos;s
                recommended data and inspiration:
              </span>
              <nav className="challenge-resource-links" aria-label="NASA Space Apps challenge resources">
                <a
                  href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  IRSA SPHEREx archive
                </a>
                <a
                  href="https://caltech-ipac.github.io/irsa-tutorials/spherex/"
                  target="_blank"
                  rel="noreferrer"
                >
                  SPHEREx Python notebooks
                </a>
                <a
                  href="http://byw.tools/wiseview"
                  target="_blank"
                  rel="noreferrer"
                >
                  WiseView inspiration
                </a>
                <a
                  href="https://archive.stsci.edu/missions-and-data/gaia"
                  target="_blank"
                  rel="noreferrer"
                >
                  Gaia mission data · DR3
                </a>
                <a
                  href="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=resources"
                  target="_blank"
                  rel="noreferrer"
                >
                  All challenge resources ↗
                </a>
              </nav>
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

      <ViewportToolbar
        settings={viewportSettings}
        onSettingsChange={setViewportSettings}
        fieldOfView={fieldOfView ? `${fieldOfView < 1 ? fieldOfView.toFixed(2) : fieldOfView.toFixed(1)}°` : "—"}
        location={location?.label ?? locationStatus}
        nightMode={nightMode}
        onNightModeChange={setNightMode}
        onFullscreen={handleFullscreen}
      />

      {authOpen && (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            setAuthOpen(false);
            setObjectActionStatus("");
            const queuedTarget = pendingSave.current;
            pendingSave.current = null;
            if (queuedTarget) void saveTarget(queuedTarget);
          }}
        />
      )}

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
