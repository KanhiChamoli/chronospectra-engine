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
      className="relative w-full select-none overflow-hidden rounded-lg border border-[#F3EFEA]/10 bg-[#0F1E36] touch-none"
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; }}
    >
      <div className="relative aspect-[2/1] w-full cursor-ew-resize">
        <img src="/sky/gaia-visible.jpg" alt="Gaia visible-light all-sky map" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <img src="/sky/spherex-infrared.jpg" alt="SPHEREx infrared all-sky map" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span className="absolute left-3 top-3 rounded border border-[#F3EFEA]/10 bg-[#0F1E36]/70 px-2 py-1 font-mono text-[10px] tracking-widest text-[#F3EFEA]/80 backdrop-blur-md">GAIA · VISIBLE</span>
        <span className="absolute right-3 top-3 rounded border border-[#F3EFEA]/10 bg-[#0F1E36]/70 px-2 py-1 font-mono text-[10px] tracking-widest text-[#E3B341] backdrop-blur-md">SPHEREx · INFRARED</span>
        <div className="absolute bottom-0 top-0 w-px bg-[#F3EFEA]/50" style={{ left: `${pos}%` }}>
          <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#E3B341]/40 bg-[#0F1E36]/85 text-xs text-[#F3EFEA] shadow-[0_0_12px_rgba(227,179,65,0.15)] backdrop-blur-md">⇆</div>
        </div>
      </div>
    </div>
  );
}
