import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HeroCinematic() {
  return (
    <section className="relative isolate min-h-[92svh] overflow-hidden bg-[#0F1E36]">
      <div className="absolute inset-0 -z-10">
        <img
          src="/constellations/orion.png"
          alt=""
          aria-hidden
          className="absolute right-[-8%] top-1/2 h-[125%] w-auto max-w-none -translate-y-1/2 object-contain opacity-[0.16] sm:right-[-2%] sm:opacity-[0.2] lg:right-[4%] lg:h-[135%] lg:opacity-[0.22]"
          style={{ filter: "sepia(0.25) saturate(0.8) brightness(0.9)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F1E36] via-[#0F1E36]/95 to-[#0F1E36]/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1E36] via-[#0F1E36]/20 to-[#0F1E36]/50" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 70% 45%, rgba(227,179,65,0.06), transparent 60%), radial-gradient(ellipse 45% 35% at 55% 60%, rgba(200,75,49,0.07), transparent 60%)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 180px 40px rgba(11,19,43,0.65)" }} />
      </div>

      <div className="mx-auto flex min-h-[92svh] max-w-7xl items-center px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] px-3.5 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E3B341] shadow-[0_0_10px_rgba(227,179,65,0.7)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#F3EFEA]/80">NASA SPACE APPS CHALLENGE 2026 · SPHEREx INFRARED SUITE</span>
          </div>
          <h1 className="mt-7 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-[#F3EFEA] sm:text-6xl lg:text-7xl">
            Explore the dynamic{" "}
            <span className="bg-gradient-to-r from-[#E3B341] via-[#F4D35E] to-[#C84B31] bg-clip-text text-transparent">infrared universe</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#F3EFEA]/70 sm:text-lg">
            Align telescope visits across 102 infrared bands, cross-match Gaia DR3 astrometry, and reveal motion, variability, and faint sources hidden in SPHEREx multi-epoch data.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/observatory" className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C84B31] to-[#E3B341] px-6 py-3 text-sm font-semibold text-[#0F1E36] shadow-[0_0_0_rgba(227,179,65,0)] transition duration-300 hover:shadow-[0_0_28px_rgba(227,179,65,0.25)] hover:brightness-110">
              Open Observatory <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/pitch-deck" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] px-6 py-3 text-sm font-medium text-[#F3EFEA] backdrop-blur-md transition hover:border-[#F3EFEA]/20 hover:bg-[#F3EFEA]/[0.06]">
              View demo
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-[#F3EFEA]/55">
            <span>0.75–5.0 µm · D1–D6</span>
            <span>Gaia DR3 astrometry</span>
            <span>Blink · Diff · Shift-stack</span>
          </div>
        </div>
      </div>
    </section>
  );
}
