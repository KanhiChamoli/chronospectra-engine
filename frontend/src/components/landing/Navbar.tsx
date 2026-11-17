"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Observatory", href: "/observatory" },
  { label: "102 Bands", href: "#capabilities" },
  { label: "Gaia DR3", href: "#compare" },
  { label: "Shift-Stack", href: "#capabilities" },
  { label: "NASA Space Apps 2026", href: "https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/", external: true },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? "border-b border-white/[0.06] bg-[#03050a]/80 backdrop-blur-xl" : "bg-transparent"}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.02]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4a574] shadow-[0_0_10px_rgba(212,165,116,0.7)]" />
          </span>
          <span className="font-serif text-[13px] tracking-[0.18em] text-[#e2e8f0]">CHRONOSPECTRA</span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => l.external ? (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#94a3b8] transition hover:text-[#f1f5f9]">{l.label}</a>
          ) : (
            <a key={l.label} href={l.href} className="text-[13px] text-[#94a3b8] transition hover:text-[#f1f5f9]">{l.label}</a>
          ))}
          <Link href="/observatory" className="rounded-md border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-[#e2e8f0] transition hover:bg-white/[0.07]">Launch</Link>
        </div>
        <button className="p-2 text-[#94a3b8] md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </nav>
      {open && (
        <div className="border-t border-white/[0.06] bg-[#03050a]/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4">
            {links.map((l) => l.external ? (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="py-1 text-sm text-[#94a3b8]">{l.label}</a>
            ) : (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="py-1 text-sm text-[#94a3b8]">{l.label}</a>
            ))}
            <Link href="/observatory" onClick={() => setOpen(false)} className="mt-1 rounded-md bg-[#f1f5f9] px-4 py-2 text-center text-sm font-medium text-[#03050a]">Launch Observatory</Link>
          </div>
        </div>
      )}
    </header>
  );
}
