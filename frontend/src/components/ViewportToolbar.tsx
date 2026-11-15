"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  Grid2x2,
  Maximize2,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  Tags,
  Waypoints,
} from "lucide-react";
import type { ViewportSettings } from "@/types/viewport";

interface ViewportToolbarProps {
  settings: ViewportSettings;
  onSettingsChange: (settings: ViewportSettings) => void;
  fieldOfView: string;
  location: string;
  nightMode: boolean;
  onNightModeChange: (enabled: boolean) => void;
  onFullscreen: () => void;
}

export function ViewportToolbar({
  settings,
  onSettingsChange,
  fieldOfView,
  location,
  nightMode,
  onNightModeChange,
  onFullscreen,
}: ViewportToolbarProps) {
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toggle = (key: keyof ViewportSettings) =>
    onSettingsChange({ ...settings, [key]: !settings[key] });

  return (
    <>
      <div className="viewport-location" aria-live="polite">{location}</div>
      <time className="viewport-time" aria-live="polite" dateTime={clock?.toISOString()}>
        {clock?.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }) ?? "—"}
      </time>
      <nav className="viewport-toolbar" aria-label="Sky view controls">
        <button type="button" title="Equatorial grid" aria-label="Toggle equatorial grid" aria-pressed={settings.equatorialGrid} onClick={() => toggle("equatorialGrid")}><Grid2x2 size={16} /></button>
        <button type="button" title="Azimuthal grid" aria-label="Toggle azimuthal grid" aria-pressed={settings.azimuthalGrid} onClick={() => toggle("azimuthalGrid")}><Compass size={16} /></button>
        <button type="button" title="Atmosphere" aria-label="Toggle atmosphere" aria-pressed={settings.atmosphere} onClick={() => toggle("atmosphere")}><Sun size={16} /></button>
        <button type="button" title="Constellation artwork" aria-label="Toggle constellation artwork" aria-pressed={settings.constellationArt} onClick={() => toggle("constellationArt")}><Sparkles size={16} /></button>
        <button type="button" title="Constellation lines" aria-label="Toggle constellation lines" aria-pressed={settings.constellationLines} onClick={() => toggle("constellationLines")}><Waypoints size={16} /></button>
        <button type="button" title="Constellation labels" aria-label="Toggle constellation labels" aria-pressed={settings.constellationLabels} onClick={() => toggle("constellationLabels")}><Tags size={16} /></button>
        <details className="view-settings">
          <summary aria-label="Open view settings" title="View settings"><Settings2 size={16} /></summary>
          <div className="view-settings-menu">
            <label><input type="checkbox" checked={settings.meridianLine} onChange={() => toggle("meridianLine")} /> Meridian line</label>
            <label><input type="checkbox" checked={settings.eclipticLine} onChange={() => toggle("eclipticLine")} /> Ecliptic line</label>
          </div>
        </details>
        <span className="fov-readout" title="Current field of view">FoV {fieldOfView}</span>
        <button type="button" title="Night mode" aria-label="Toggle night mode" aria-pressed={nightMode} onClick={() => onNightModeChange(!nightMode)}><Moon size={16} /></button>
        <button type="button" title="Fullscreen" aria-label="Toggle fullscreen" onClick={onFullscreen}><Maximize2 size={16} /></button>
      </nav>
    </>
  );
}
