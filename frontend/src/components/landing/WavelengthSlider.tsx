"use client";

import { useRef, useState } from "react";

export default function WavelengthSlider() {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  };

  return (
    <div
      ref={ref}
      className="relative w-full select-none overflow-hidden rounded-xl border border-white/[0.08] bg-[#03050a] touch-none"
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; }}
    >
      <div className="relative aspect-[2/1] w-full cursor-ew-resize">
        <img src="/sky/gaia-visible.jpg" alt="Gaia visible-light all-sky map" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <img src="/sky/spherex-infrared.jpg" alt="SPHEREx infrared all-sky map" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span className="absolute left-3 top-3 rounded border border-white/10 bg-[#03050a]/70 px-2 py-1 font-mono text-[10px] tracking-widest text-[#cbd5e1] backdrop-blur">GAIA · VISIBLE</span>
        <span className="absolute right-3 top-3 rounded border border-white/10 bg-[#03050a]/70 px-2 py-1 font-mono text-[10px] tracking-widest text-[#d4a574] backdrop-blur">SPHEREx · INFRARED</span>
        <div className="absolute bottom-0 top-0 w-px bg-[#e2e8f0]/60" style={{ left: `${pos}%` }}>
          <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#03050a]/85 text-xs text-[#f1f5f9] backdrop-blur">⇆</div>
        </div>
      </div>
    </div>
  );
}
