import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import HeroCinematic from "@/components/landing/HeroCinematic";
import WavelengthSlider from "@/components/landing/WavelengthSlider";

const GITHUB_URL = "https://github.com/KanhiChamoli/chronospectra-engine";

const capabilities = [
  { title: "102-Band LVF Inspection", desc: "Switchable D1–D6 detector arrays with wavelength and flux readouts across 0.75–5.0 µm." },
  { title: "Gaia DR3 Cross-Match", desc: "Astrometric verification with proper-motion vectors, per-visit residuals, and candidate triage." },
  { title: "Blink, Diff & Stack", desc: "Multi-epoch comparison and differencing to isolate movers, transients, and variable sources." },
  { title: "Planet X Shift-Stack", desc: "Velocity-aligned coaddition to surface faint, slow-moving sources below single-visit noise." },
  { title: "Light Curves & R≈40 Spectra", desc: "Multi-exposure photometry and binned 102-channel spectra with key infrared markers." },
  { title: "Discovery Packets", desc: "Reproducible exports with coordinates, residuals, photometry, spectra, and shareable links." },
];

export default function LandingPageClient() {
  return (
    <div className="min-h-screen bg-[#0F1E36] text-[#F3EFEA] antialiased">
      <Navbar />
      <main>
        <HeroCinematic />

        <section id="about" className="border-t border-[#F3EFEA]/10 py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-[#48CAE4]/90">OBSERVATORY SUITE</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#F3EFEA] sm:text-4xl">A minimalist console for SPHEREx discovery</h2>
              <p className="mt-4 text-base leading-relaxed text-[#F3EFEA]/70">Chronospectra brings museum-grade clarity to astrophysical telemetry — aligning 102-band infrared visits, cross-matching Gaia DR3, and presenting motion and variability in a calm, professional workspace.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{ k: "102", l: "Infrared bands", s: "LVF D1–D6 · 0.75–5.0 µm" }, { k: "Gaia DR3", l: "Astrometric match", s: "Residuals & proper motion" }, { k: "Multi-epoch", l: "Blink · Diff · Stack", s: "Motion & variability" }, { k: "Export", l: "Discovery packets", s: "Reproducible evidence" }].map((m) => (
                <div key={m.l} className="rounded-xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] p-5 backdrop-blur-md">
                  <div className="font-serif text-2xl text-[#E3B341]">{m.k}</div>
                  <div className="mt-1 text-sm text-[#F3EFEA]">{m.l}</div>
                  <div className="mt-1 font-mono text-[11px] text-[#F3EFEA]/55">{m.s}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-t border-[#F3EFEA]/10 py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] tracking-[0.22em] text-[#48CAE4]/90">102 BANDS · CAPABILITIES</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#F3EFEA] sm:text-4xl">Telemetry-grade analysis modules</h2>
              <p className="mt-4 text-base leading-relaxed text-[#F3EFEA]/70">Inspect spectral context, detect change across epochs, and package reproducible findings — structured for clarity and speed.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((c) => (
                <div key={c.title} className="rounded-xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] p-6 backdrop-blur-md transition hover:border-[#F3EFEA]/20 hover:bg-[#F3EFEA]/[0.05]">
                  <h3 className="font-serif text-lg text-[#F3EFEA]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#F3EFEA]/65">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="compare" className="border-t border-[#F3EFEA]/10 py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-[#48CAE4]/90">SAME SKY, DIFFERENT LIGHT</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#F3EFEA] sm:text-4xl">Gaia optical vs SPHEREx infrared</h2>
              <p className="mt-4 text-base leading-relaxed text-[#F3EFEA]/70">Compare visible starlight against infrared emission to reveal dust, ices, cool dwarfs, and structure invisible in optical surveys.</p>
              <dl className="mt-8 space-y-3 font-mono text-xs text-[#F3EFEA]/55">
                <div className="flex justify-between border-b border-[#F3EFEA]/10 pb-2"><dt>Spectral coverage</dt><dd className="text-[#48CAE4]">0.75–5.0 µm</dd></div>
                <div className="flex justify-between border-b border-[#F3EFEA]/10 pb-2"><dt>Detector arrays</dt><dd className="text-[#F3EFEA]/80">D1–D6 · 102 channels</dd></div>
                <div className="flex justify-between border-b border-[#F3EFEA]/10 pb-2"><dt>Astrometric reference</dt><dd className="text-[#F3EFEA]/80">Gaia DR3</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] p-3 backdrop-blur-md">
              <WavelengthSlider />
            </div>
          </div>
        </section>

        <section className="border-t border-[#F3EFEA]/10 py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-8 rounded-xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] p-8 backdrop-blur-md sm:p-10 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] tracking-[0.22em] text-[#F3EFEA]/55">NASA SPACE APPS 2026 · PLANET X & SPHEREx</p>
                <h2 className="mt-3 font-serif text-2xl font-semibold text-[#F3EFEA] sm:text-3xl">Enter the observatory</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#F3EFEA]/70 sm:text-base">Cutout inspection, epoch blinking, Gaia residuals, spectra, and export workflows — available in the browser.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link href="/observatory" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C84B31] to-[#E3B341] px-5 py-3 text-sm font-semibold text-[#0F1E36] transition hover:shadow-[0_0_24px_rgba(227,179,65,0.22)] hover:brightness-110">Launch Observatory <ArrowRight className="h-4 w-4" /></Link>
                <a href="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] px-5 py-3 text-sm text-[#F3EFEA] backdrop-blur-md transition hover:border-[#F3EFEA]/20 hover:bg-[#F3EFEA]/[0.06]">Challenge Brief <ExternalLink className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#F3EFEA]/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative grid h-7 w-7 place-items-center rounded-full border border-[#E3B341]/50"><span className="h-1.5 w-1.5 rounded-full bg-[#E3B341]" /></span>
              <span className="font-serif text-[13px] tracking-[0.18em] text-[#F3EFEA]">CHRONOSPECTRA</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-[#F3EFEA]/60">Open-source SPHEREx infrared observatory for multi-epoch analysis and Gaia DR3 cross-matching.</p>
            <p className="mt-3 font-mono text-[11px] text-[#F3EFEA]/45">Data: NASA/IPAC IRSA · ESA/Gaia/DPAC. Not an official NASA/ESA product.</p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm lg:items-end">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[#F3EFEA]/65">
              <Link href="/observatory" className="transition hover:text-[#F3EFEA]">Observatory</Link>
              <Link href="/pitch-deck" className="transition hover:text-[#F3EFEA]">Demo</Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-[#F3EFEA]">GitHub</a>
            </div>
            <p className="text-xs text-[#F3EFEA]/45">© 2026 Chronospectra · Kanhi Chamoli</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
