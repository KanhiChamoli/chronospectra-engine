"use client";
import { X } from "lucide-react";

const shortcuts = [
  { key: "Space", action: "Play / Pause blink" },
  { key: "← →", action: "Step to previous / next epoch" },
  { key: "D", action: "Toggle Diff mode" },
  { key: "B", action: "Toggle Blink mode" },
  { key: "S", action: "Toggle Stack mode" },
  { key: "G", action: "Show Gaia DR3 overlay" },
  { key: "F", action: "Toggle contamination flags" },
  { key: "C", action: "Show community finds" },
  { key: "X", action: "Planet X shift-stack controls" },
  { key: "P", action: "Switch plots / image view" },
  { key: "1–5", action: "Load challenge presets (Barnard → R Dra)" },
  { key: "?", action: "Open keyboard shortcut guide" },
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
