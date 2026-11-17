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
    <div className="min-h-screen bg-[#03050a] text-[#e2e8f0] antialiased">
      <Navbar />
      <main>
        <HeroCinematic />

        <section id="capabilities" className="border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] tracking-[0.22em] text-[#7dd3fc]/80">CAPABILITIES</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#f1f5f9] sm:text-4xl">A focused infrared analysis suite</h2>
              <p className="mt-4 text-base leading-relaxed text-[#94a3b8]">From 102-band spectral context to motion detection and reproducible export — built for SPHEREx multi-epoch discovery workflows.</p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((c) => (
                <div key={c.title} className="bg-[#03050a] p-6 sm:p-7 transition-colors hover:bg-[#070a12]">
                  <h3 className="font-serif text-lg text-[#f1f5f9]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="compare" className="border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-[#7dd3fc]/80">SAME SKY, DIFFERENT LIGHT</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#f1f5f9] sm:text-4xl">Gaia optical vs SPHEREx infrared</h2>
              <p className="mt-4 text-base leading-relaxed text-[#94a3b8]">Compare visible starlight against infrared emission to reveal dust, ices, cool dwarfs, and structure invisible in optical surveys.</p>
              <dl className="mt-8 space-y-3 font-mono text-xs text-[#64748b]">
                <div className="flex justify-between border-b border-white/[0.06] pb-2"><dt>Spectral coverage</dt><dd className="text-[#cbd5e1]">0.75–5.0 µm</dd></div>
                <div className="flex justify-between border-b border-white/[0.06] pb-2"><dt>Detector arrays</dt><dd className="text-[#cbd5e1]">D1–D6 · 102 channels</dd></div>
                <div className="flex justify-between border-b border-white/[0.06] pb-2"><dt>Astrometric reference</dt><dd className="text-[#cbd5e1]">Gaia DR3</dd></div>
              </dl>
            </div>
            <WavelengthSlider />
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] tracking-[0.22em] text-[#64748b]">NASA SPACE APPS 2026 · PLANET X & SPHEREx</p>
                <h2 className="mt-3 font-serif text-2xl font-semibold text-[#f1f5f9] sm:text-3xl">Open the observatory</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#94a3b8] sm:text-base">Cutout inspection, epoch blinking, Gaia residuals, spectra, and export workflows — available in the browser.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link href="/observatory" className="inline-flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-5 py-3 text-sm font-medium text-[#03050a] transition hover:bg-white">Launch <ArrowRight className="h-4 w-4" /></Link>
                <a href="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-5 py-3 text-sm text-[#e2e8f0] transition hover:bg-white/[0.05]">Challenge <ExternalLink className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md border border-white/10"><span className="h-1.5 w-1.5 rounded-full bg-[#d4a574]" /></span>
              <span className="font-serif text-[13px] tracking-[0.18em] text-[#e2e8f0]">CHRONOSPECTRA</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-[#64748b]">Open-source SPHEREx infrared observatory for multi-epoch analysis and Gaia DR3 cross-matching.</p>
            <p className="mt-3 font-mono text-[11px] text-[#475569]">Data: NASA/IPAC IRSA · ESA/Gaia/DPAC. Not an official NASA/ESA product.</p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm lg:items-end">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[#94a3b8]">
              <Link href="/observatory" className="transition hover:text-[#f1f5f9]">Observatory</Link>
              <Link href="/pitch-deck" className="transition hover:text-[#f1f5f9]">Demo</Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-[#f1f5f9]">GitHub</a>
            </div>
            <p className="text-xs text-[#475569]">© 2026 Chronospectra · Kanhi Chamoli</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
