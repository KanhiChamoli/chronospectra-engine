"use client";
import { X } from "lucide-react";

const shortcuts = [
  { key: "1–5", action: "Load challenge presets (Barnard, ε Indi B, WISE 0855, RW Aur, R Dra)" },
  { key: "P", action: "Toggle Plots view (light curve + 102-band spectrum)" },
  { key: "B", action: "Open 8′ Cutout Inspector (blink view)" },
  { key: "W", action: "Open All-Sky WWT viewport" },
  { key: "S", action: "Show / hide the side menu" },
  { key: "H", action: "Share this view (copies deep-link URL)" },
  { key: "T", action: "Open the guided tour" },
  { key: "F", action: "Toggle fullscreen viewport" },
  { key: "Space", action: "Play / Pause blink playback (in cutout view)" },
  { key: "← →", action: "Step to previous / next epoch" },
  { key: "D", action: "Toggle Diff mode" },
  { key: "G", action: "Show Gaia DR3 overlay" },
  { key: "C", action: "Show candidate finds" },
  { key: "X", action: "Planet X shift-stack controls" },
  { key: "?", action: "Open this keyboard shortcut guide" },
  { key: "Esc", action: "Close modal / clear selection" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutGuide({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  return (
    <div
      className="shortcut-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="shortcut-guide-modal">
        <div className="shortcut-guide-header">
          <h2>Keyboard Shortcuts</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="shortcut-guide-body">
          {shortcuts.map((s) => (
            <div key={s.key} className="shortcut-row">
              <kbd className="shortcut-key">{s.key}</kbd>
              <span className="shortcut-action">{s.action}</span>
            </div>
          ))}
        </div>
        <p className="shortcut-guide-hint">Press <kbd>?</kbd> at any time to open this guide</p>
      </div>
    </div>
  );
}
