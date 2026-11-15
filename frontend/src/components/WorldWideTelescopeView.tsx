"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  BandPass,
  ImageSetType,
  ProjectionType,
} from "@wwtelescope/engine-types";
import type {
  Imageset,
  WWTControl as WWTControlType,
} from "@wwtelescope/engine";
import type { Anomaly } from "@/types/spectroscopy";

interface WorldWideTelescopeViewProps {
  anomalies: Anomaly[];
  hipsBaseUrl: string;
  initialTarget: { raDeg: number; decDeg: number } | null;
  onSkyClick: (raDeg: number, decDeg: number) => void;
  onAnomalySelect: (anomaly: Anomaly) => void;
}

interface PinPosition {
  anomaly: Anomaly;
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
  onSkyClick,
  onAnomalySelect,
}: WorldWideTelescopeViewProps) {
  const generatedId = useId();
  const viewerId = `wwt-view-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<WWTControlType | null>(null);
  const engineRef = useRef<WWTModule | null>(null);
  const overlayRequest = useRef<AbortController | null>(null);
  const overlayImagesets = useRef(new Map<SurveyOverlayId, Imageset>());
  const [status, setStatus] = useState("Starting WWT");
  const [isReady, setIsReady] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState<SurveyOverlayId>("none");
  const [overlayStatus, setOverlayStatus] = useState("");
  const [pins, setPins] = useState<PinPosition[]>([]);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const flyTo = useCallback((raDeg: number, decDeg: number) => {
    controlRef.current?.gotoRADecZoom(raDeg / 15, decDeg, 5, false, 0, 1.2);
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryFrame = 0;
    let propertiesTimer: number | undefined;
    const request = new AbortController();
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
                  setStatus("SPHEREx DR1 HiPS loaded · drag to pan · pinch or wheel to zoom");
                }
              }, 250);
            } catch (error) {
              setStatus(
                error instanceof Error
                  ? `SPHEREx HiPS unavailable: ${error.message}`
                  : "SPHEREx HiPS unavailable",
              );
            }
          });
        } catch (error) {
          if (!disposed && !request.signal.aborted) {
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
    };
  }, [hipsBaseUrl, viewerId]);

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
      const control = controlRef.current;
      const container = containerRef.current;
      const canvas = container?.querySelector("canvas");
      if (!control || !container || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || !canvas.width || !canvas.height) return;
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
      setPins(nextPins);
    }, 250);

    return () => {
      window.clearInterval(updateTimer);
    };
  }, [anomalies, viewerId]);

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
