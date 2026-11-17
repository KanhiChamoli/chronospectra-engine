import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HeroCinematic() {
  return (
    <section className="relative isolate min-h-[92svh] overflow-hidden bg-[#03050a]">
      <div className="absolute inset-0 -z-10">
        <img
          src="/constellations/orion.png"
          alt=""
          aria-hidden
          className="absolute right-[-10%] top-1/2 h-[120%] w-auto max-w-none -translate-y-1/2 object-contain opacity-[0.22] sm:right-[-4%] sm:opacity-[0.28] lg:right-[2%] lg:h-[130%] lg:opacity-[0.32]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#03050a] via-[#03050a]/92 to-[#03050a]/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03050a] via-transparent to-[#03050a]/40" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 75% 45%, rgba(125,211,252,0.08), transparent 60%), radial-gradient(ellipse 40% 35% at 60% 55%, rgba(212,165,116,0.10), transparent 60%)" }} />
      </div>

      <div className="mx-auto flex min-h-[92svh] max-w-7xl items-center px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-24">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.22em] text-[#7dd3fc]/90">SPHEREx INFRARED OBSERVATORY · NASA SPACE APPS 2026</p>
          <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-[#f1f5f9] sm:text-6xl lg:text-7xl">
            Explore the dynamic infrared universe across <span className="text-[#d4a574]">102 colors</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#94a3b8] sm:text-lg">
            Align multi-epoch SPHEREx visits, cross-match Gaia DR3, and detect motion and variability hidden in the near-infrared sky.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/observatory" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f1f5f9] px-6 py-3 text-sm font-medium text-[#03050a] transition hover:bg-white">
              Open Observatory <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pitch-deck" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.02] px-6 py-3 text-sm font-medium text-[#e2e8f0] transition hover:border-white/20 hover:bg-white/[0.05]">
              View demo
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-[#64748b]">
            <span>0.75–5.0 µm · D1–D6</span>
            <span>Gaia DR3 astrometry</span>
            <span>Blink · Diff · Shift-stack</span>
          </div>
        </div>
      </div>
    </section>
  );
}
