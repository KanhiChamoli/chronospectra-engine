"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  BandPass,
  ImageSetType,
  ProjectionType,
} from "@wwtelescope/engine-types";
import type {
  Imageset,
  Settings,
  WWTControl as WWTControlType,
} from "@wwtelescope/engine";
import type { Anomaly } from "@/types/spectroscopy";
import { celestialCatalog, type CelestialTarget } from "@/lib/celestialCatalog";
import type { ViewportSettings } from "@/types/viewport";

interface WorldWideTelescopeViewProps {
  anomalies: Anomaly[];
  hipsBaseUrl: string;
  initialTarget: { raDeg: number; decDeg: number } | null;
  viewportSettings: ViewportSettings;
  observerLongitude: number | null;
  selectedTargetId: string | null;
  onFieldOfViewChange: (degrees: number) => void;
  onSkyClick: (raDeg: number, decDeg: number) => void;
  onAnomalySelect: (anomaly: Anomaly) => void;
  onTargetSelect: (target: CelestialTarget) => void;
}

interface PinPosition {
  anomaly: Anomaly;
  left: number;
  top: number;
}

interface TargetLabelPosition {
  target: CelestialTarget;
  left: number;
  top: number;
}

interface ScreenPosition {
  left: number;
  top: number;
}

type WWTModule = typeof import("@wwtelescope/engine");
type SurveyOverlayId = "none" | "wise" | "2mass";

interface SurveyOverlay {
  label: string;
  name: string;
  id: number;
  baseUrl: string;
}

const hipsImageSetName = "SPHEREx DR1 HiPS";
const hipsImageSetId = 987654321;
const surveyOverlays: Record<Exclude<SurveyOverlayId, "none">, SurveyOverlay> = {
  wise: {
    label: "AllWISE RGB (W4/W2/W1)",
    name: "Chronospectra AllWISE RGB",
    id: 987654322,
    baseUrl: "https://irsa.ipac.caltech.edu/data/hips/CDS/AllWISE/RGB-W4-W2-W1",
  },
  "2mass": {
    label: "2MASS color",
    name: "Chronospectra 2MASS color",
    id: 987654323,
    baseUrl: "https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color",
  },
};

function sameProjectedPositions<T extends ScreenPosition>(
  previous: T[],
  next: T[],
  key: (position: T) => string,
): boolean {
  return previous.length === next.length && previous.every((position, index) => {
    const updated = next[index];
    return key(position) === key(updated) &&
      Math.abs(position.left - updated.left) < 0.5 &&
      Math.abs(position.top - updated.top) < 0.5;
  });
}

function createHipsImageset(
  engine: WWTModule,
  hipsBaseUrl: string,
  propertiesText: string,
  name = hipsImageSetName,
  id = hipsImageSetId,
): Imageset {
  const properties = new Map<string, string>();
  for (const line of propertiesText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    properties.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    );
  }
  const order = Number(properties.get("hips_order"));
  const tileFormat = properties.get("hips_tile_format")?.split(/\s+/)[0];
  if (!Number.isInteger(order) || order < 0 || !tileFormat) {
    throw new Error("The HiPS properties response is missing tile order or format.");
  }
  if (!["png", "jpg", "jpeg"].includes(tileFormat.toLowerCase())) {
    throw new Error(`Unsupported WWT HiPS tile format: ${tileFormat}`);
  }

  const root = hipsBaseUrl.replace(/\/+$/, "");
  const url = `${root}/Norder{0}/Dir{1}/Npix{2}`;
  const tileExtension = tileFormat.toLowerCase() === "jpeg" ? ".jpg" : `.${tileFormat}`;
  // WWT's runtime adds HEALPix=7 although engine-types omits it from the enum.
  const hipsProjection = 7 as ProjectionType;
  return engine.Imageset.create(
    name,
    url,
    ImageSetType.sky,
    BandPass.IR,
    hipsProjection,
    id,
    0,
    order,
    null,
    90,
    tileExtension,
    false,
    "",
    180,
    -57.99462,
    0,
    false,
    "",
    false,
    false,
    1,
    0,
    0,
    "NASA/SPHEREx · Caltech/IPAC",
    "https://irsa.ipac.caltech.edu/Missions/spherex.html",
    "",
    "",
    1,
    "Sky",
  );
}

export function WorldWideTelescopeView({
  anomalies,
  hipsBaseUrl,
  initialTarget,
  viewportSettings,
  observerLongitude,
  selectedTargetId,
  onFieldOfViewChange,
  onSkyClick,
  onAnomalySelect,
  onTargetSelect,
}: WorldWideTelescopeViewProps) {
  const generatedId = useId();
  const viewerId = `wwt-view-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<WWTControlType | null>(null);
  const engineRef = useRef<WWTModule | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const overlayRequest = useRef<AbortController | null>(null);
  const overlayImagesets = useRef(new Map<SurveyOverlayId, Imageset>());
  const [status, setStatus] = useState("Starting WWT");
  const [isReady, setIsReady] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState<SurveyOverlayId>("none");
  const [overlayStatus, setOverlayStatus] = useState("");
  const [pins, setPins] = useState<PinPosition[]>([]);
  const [targetLabels, setTargetLabels] = useState<TargetLabelPosition[]>([]);
  const [meridianPath, setMeridianPath] = useState("");
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const pinsRef = useRef<PinPosition[]>([]);
  const targetLabelsRef = useRef<TargetLabelPosition[]>([]);
  const overlaySizeRef = useRef({ width: 0, height: 0 });
  const meridianPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastFov = useRef("");
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const flyTo = useCallback((raDeg: number, decDeg: number) => {
    controlRef.current?.gotoRADecZoom(raDeg / 15, decDeg, 5, false, 0, 1.2);
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryFrame = 0;
    let propertiesTimer: number | undefined;
    const request = new AbortController();
    const startupTimer = window.setTimeout(() => {
      if (!disposed) {
        setStatus("WWT is taking longer than usual; the DR1 imagery may still be streaming from IRSA.");
      }
    }, 15_000);
    retryFrame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const engine = await import("@wwtelescope/engine");
          if (disposed || !containerRef.current) {
            return;
          }
          engineRef.current = engine;

          setStatus("Loading SPHEREx DR1 HiPS properties…");
          const baseUrl = hipsBaseUrl.replace(/\/+$/, "");
          const response = await fetch(`${baseUrl}/properties`, {
            signal: request.signal,
          });
          if (!response.ok) {
            throw new Error(`HiPS properties request failed (${response.status}).`);
          }
          const propertiesText = await response.text();
          if (disposed) return;

          const builder = new engine.WWTControlBuilder(viewerId);
          builder.initialMode("Sky");
          builder.initialView(180, -57.99462, 360);
          builder.startRenderLoop(true);
          const scriptInterface = builder.create();
          const control = engine.WWTControl.singleton;

          scriptInterface.add_ready(() => {
            if (disposed) return;
            controlRef.current = control;
            settingsRef.current = scriptInterface.settings;
            scriptInterface.settings.set_showSolarSystem(true);
            scriptInterface.settings.set_solarSystemPlanets(true);
            setIsReady(true);
            try {
              const existing = control.getImagesetByName(hipsImageSetName);
              const imageset =
                existing ??
                engine.WWTControl.addImageSetToRepository(
                  createHipsImageset(engine, hipsBaseUrl, propertiesText),
                );
              control.setBackgroundImageByName(imageset.get_name());
              setStatus("Loading SPHEREx DR1 HiPS tiles…");
              propertiesTimer = window.setInterval(() => {
                const loadedProperties = imageset.get_hipsProperties()?.get_properties();
                if (loadedProperties?.hips_order) {
                  if (propertiesTimer !== undefined) {
                    window.clearInterval(propertiesTimer);
                  }
                  window.clearTimeout(startupTimer);
                  setStatus("SPHEREx DR1 layer ready · tiles stream on demand · drag to pan · pinch or wheel to zoom");
                }
              }, 250);
            } catch (error) {
              window.clearTimeout(startupTimer);
              setStatus(
                error instanceof Error
                  ? `SPHEREx HiPS unavailable: ${error.message}`
                  : "SPHEREx HiPS unavailable",
              );
            }
          });
        } catch (error) {
          if (!disposed && !request.signal.aborted) {
            window.clearTimeout(startupTimer);
            setStatus(
              error instanceof Error
                ? `SPHEREx HiPS unavailable: ${error.message}`
                : "SPHEREx HiPS unavailable",
            );
          }
        }
      })();
    });

    return () => {
      disposed = true;
      request.abort();
      overlayRequest.current?.abort();
      window.cancelAnimationFrame(retryFrame);
      if (propertiesTimer !== undefined) {
        window.clearInterval(propertiesTimer);
      }
      window.clearTimeout(startupTimer);
    };
  }, [hipsBaseUrl, viewerId]);

  useEffect(() => {
    const settings = settingsRef.current;
    if (!isReady || !settings) return;
    settings.set_showGrid(viewportSettings.equatorialGrid);
    settings.set_showEquatorialGridText(viewportSettings.equatorialGrid);
    settings.set_showAltAzGrid(viewportSettings.azimuthalGrid);
    settings.set_showAltAzGridText(viewportSettings.azimuthalGrid);
    settings.set_showEarthSky(viewportSettings.atmosphere);
    settings.set_showConstellationPictures(viewportSettings.constellationArt);
    settings.set_showConstellationFigures(viewportSettings.constellationLines);
    settings.set_showConstellationBoundries(viewportSettings.constellationLines);
    settings.set_showConstellationLabels(viewportSettings.constellationLabels);
    settings.set_constellationFigureColor("rgba(0, 240, 255, 0.72)");
    settings.set_constellationBoundryColor("rgba(0, 240, 255, 0.42)");
    settings.set_showEcliptic(viewportSettings.eclipticLine);
  }, [isReady, viewportSettings]);

  useEffect(() => {
    if (isReady && initialTarget) {
      flyTo(initialTarget.raDeg, initialTarget.decDeg);
    }
  }, [flyTo, initialTarget, isReady]);

  const selectOverlay = useCallback(async (overlayId: SurveyOverlayId) => {
    overlayRequest.current?.abort();
    const control = controlRef.current;
    if (!control) return;
    if (overlayId === "none") {
      control.renderContext.set_foregroundImageset(null);
      control.renderContext.viewCamera.opacity = 100;
      setSelectedOverlay("none");
      setOverlayStatus("No survey overlay");
      return;
    }

    const request = new AbortController();
    overlayRequest.current = request;
    setSelectedOverlay(overlayId);
    const overlay = surveyOverlays[overlayId];
    setOverlayStatus(`Loading ${overlay.label}…`);
    try {
      let imageset = overlayImagesets.current.get(overlayId);
      if (!imageset) {
        const response = await fetch(`${overlay.baseUrl}/properties`, {
          signal: request.signal,
        });
        if (!response.ok) {
          throw new Error(`${overlay.label} properties request failed (${response.status}).`);
        }
        const propertiesText = await response.text();
        if (request.signal.aborted) return;
        const engine = engineRef.current;
        if (!engine) throw new Error("The WWT engine is not ready.");
        imageset = engine.WWTControl.addImageSetToRepository(
          createHipsImageset(
            engine,
            overlay.baseUrl,
            propertiesText,
            overlay.name,
            overlay.id,
          ),
        );
        overlayImagesets.current.set(overlayId, imageset);
      }
      if (request.signal.aborted) return;
      control.renderContext.set_foregroundImageset(imageset);
      control.renderContext.viewCamera.opacity = 65;
      setOverlayStatus(`${overlay.label} overlay active`);
    } catch (error) {
      if (!request.signal.aborted) {
        setSelectedOverlay("none");
        setOverlayStatus(
          error instanceof Error ? `Overlay unavailable: ${error.message}` : "Overlay unavailable.",
        );
      }
    }
  }, []);

  useEffect(() => {
    const updateTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const control = controlRef.current;
      const container = containerRef.current;
      const canvas = container?.querySelector("canvas");
      if (!control || !container || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || !canvas.width || !canvas.height) return;
      if (
        Math.abs(overlaySizeRef.current.width - rect.width) >= 1 ||
        Math.abs(overlaySizeRef.current.height - rect.height) >= 1
      ) {
        overlaySizeRef.current = { width: rect.width, height: rect.height };
        setOverlaySize(overlaySizeRef.current);
      }
      const fov = control.renderContext.get_fovAngle();
      const formattedFov = `${fov < 1 ? fov.toFixed(2) : fov.toFixed(1)}°`;
      if (formattedFov !== lastFov.current) {
        lastFov.current = formattedFov;
        onFieldOfViewChange(fov);
      }
      const nextPins = anomalies.flatMap((anomaly) => {
        const screenPoint = control.getScreenPointForCoordinates(
          anomaly.ra_deg / 15,
          anomaly.dec_deg,
        );
        if (
          !Number.isFinite(screenPoint.x) ||
          !Number.isFinite(screenPoint.y) ||
          screenPoint.x < 0 ||
          screenPoint.y < 0 ||
          screenPoint.x > canvas.width ||
          screenPoint.y > canvas.height
        ) {
          return [];
        }
        return [
          {
            anomaly,
            left: (screenPoint.x / canvas.width) * rect.width,
            top: (screenPoint.y / canvas.height) * rect.height,
          },
        ];
      });
      if (!sameProjectedPositions(
        pinsRef.current,
        nextPins,
        (position) => `${position.anomaly.target_id}:${position.anomaly.epoch_a}:${position.anomaly.epoch_b}`,
      )) {
        pinsRef.current = nextPins;
        setPins(nextPins);
      }
      const nextLabels = celestialCatalog
        .filter((target) => target.id !== "sun")
        .map((target) => {
          const point = control.getScreenPointForCoordinates(target.raDeg / 15, target.decDeg);
          if (
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y) ||
            point.x < 0 ||
            point.y < 0 ||
            point.x > canvas.width ||
            point.y > canvas.height
          ) return null;
          return {
            target,
            left: (point.x / canvas.width) * rect.width,
            top: (point.y / canvas.height) * rect.height,
          };
        })
        .filter((label): label is TargetLabelPosition => label !== null);
      if (!sameProjectedPositions(
        targetLabelsRef.current,
        nextLabels,
        (position) => position.target.id,
      )) {
        targetLabelsRef.current = nextLabels;
        setTargetLabels(nextLabels);
      }
      if (viewportSettings.meridianLine && observerLongitude !== null) {
        const julianDate = Date.now() / 86_400_000 + 2_440_587.5;
        const days = julianDate - 2_451_545;
        const gmst = 280.46061837 + 360.98564736629 * days;
        const rightAscension = ((gmst + observerLongitude) % 360 + 360) % 360 / 15;
        const points: Array<{ x: number; y: number }> = [];
        for (let dec = -80; dec <= 80; dec += 5) {
          const point = control.getScreenPointForCoordinates(rightAscension, dec);
          if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
            points.push({
              x: (point.x / canvas.width) * rect.width,
              y: (point.y / canvas.height) * rect.height,
            });
          }
        }
        const previous = meridianPointsRef.current;
        const pointsChanged = previous.length !== points.length || previous.some((point, index) =>
          Math.abs(point.x - points[index].x) >= 0.5 ||
          Math.abs(point.y - points[index].y) >= 0.5
        );
        if (pointsChanged) {
          meridianPointsRef.current = points;
          setMeridianPath(
            points.length > 1
              ? `M ${points.map(({ x, y }) => `${x},${y}`).join(" L ")}`
              : "",
          );
        }
      } else {
        if (meridianPointsRef.current.length) {
          meridianPointsRef.current = [];
          setMeridianPath("");
        }
      }
    }, 250);

    return () => {
      window.clearInterval(updateTimer);
    };
  }, [anomalies, observerLongitude, onFieldOfViewChange, viewportSettings.meridianLine, viewerId]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (
      !start ||
      !controlRef.current ||
      (event.target as HTMLElement).closest("[data-map-control]")
    ) return;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > 8 || (event.target as HTMLElement).closest("[data-anomaly-pin]")) {
      return;
    }

    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const pixelY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const coordinate = controlRef.current.getCoordinatesForScreenPoint(
      pixelX,
      pixelY,
    );
    if (!coordinate || !Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)) {
      return;
    }
    const raDeg = ((coordinate.x * 15) % 360 + 360) % 360;
    const decDeg = coordinate.y;
    onSkyClick(raDeg, decDeg);
  };

  return (
    <div
      className="wwt-shell"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-label="Interactive WorldWide Telescope sky map"
    >
      <div id={viewerId} ref={containerRef} className="wwt-canvas" />
      {overlaySize.width > 0 && (
        <svg
          className="sky-guide-overlay"
          viewBox={`0 0 ${overlaySize.width} ${overlaySize.height}`}
          aria-hidden="true"
        >
          {meridianPath && <path className="meridian-guide" d={meridianPath} />}
        </svg>
      )}
      <div className="map-status" role="status">{status}</div>
      <label className="survey-overlay-control" data-map-control>
        <span>EXTERNAL SURVEY</span>
        <select
          value={selectedOverlay}
          disabled={!isReady}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "none" || value === "wise" || value === "2mass") {
              void selectOverlay(value);
            }
          }}
          aria-label="External survey overlay"
        >
          <option value="none">SPHEREx only</option>
          <option value="wise">AllWISE RGB</option>
          <option value="2mass">2MASS color</option>
        </select>
        <small aria-live="polite">{overlayStatus}</small>
      </label>
      {targetLabels.map(({ target, left, top }) => (
        <button
          className={`sky-object-label${selectedTargetId === target.id ? " selected" : ""}`}
          key={target.id}
          type="button"
          data-map-control
          style={{ left, top }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={() => onTargetSelect(target)}
          aria-label={`Open ${target.name} details`}
        >
          {target.name}
        </button>
      ))}
      {pins.map(({ anomaly, left, top }) => (
        <button
          key={`${anomaly.target_id}-${anomaly.epoch_a}-${anomaly.epoch_b}`}
          data-anomaly-pin
          type="button"
          className="anomaly-pin"
          style={{ left, top }}
          title={`${anomaly.target_name}: ${Math.abs(anomaly.significance).toFixed(1)} sigma`}
          aria-label={`Jump to anomaly ${anomaly.target_name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            flyTo(anomaly.ra_deg, anomaly.dec_deg);
            onAnomalySelect(anomaly);
          }}
        >
          <span />
        </button>
      ))}
      <div className="map-hint">CLICK SKY PIXEL TO EXTRACT · {anomalies.length} CANDIDATE PINS</div>
    </div>
  );
}
