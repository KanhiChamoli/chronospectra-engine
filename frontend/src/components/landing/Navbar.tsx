"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  { label: "About", href: "#about" },
  { label: "102 Bands", href: "#capabilities" },
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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? "border-b border-[#F3EFEA]/10 bg-[#0F1E36]/80 backdrop-blur-md" : "bg-transparent"}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center rounded-full border border-[#E3B341]/50 bg-[#F3EFEA]/[0.03]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E3B341] shadow-[0_0_10px_rgba(227,179,65,0.9)]" />
            <span className="pointer-events-none absolute inset-[-3px] rounded-full border border-[#E3B341]/20" />
          </span>
          <span className="font-serif text-[13px] tracking-[0.18em] text-[#F3EFEA]">CHRONOSPECTRA</span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => l.external ? (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#F3EFEA]/70 transition hover:text-[#F3EFEA]">{l.label}</a>
          ) : (
            <a key={l.label} href={l.href} className="text-[13px] text-[#F3EFEA]/70 transition hover:text-[#F3EFEA]">{l.label}</a>
          ))}
          <Link href="/observatory" className="rounded-md border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-[#F3EFEA] backdrop-blur-md transition hover:border-[#E3B341]/40 hover:bg-[#F3EFEA]/[0.06]">Observatory</Link>
        </div>
        <button className="p-2 text-[#F3EFEA]/70 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </nav>
      {open && (
        <div className="border-t border-[#F3EFEA]/10 bg-[#0F1E36]/95 backdrop-blur-md md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4">
            {links.map((l) => l.external ? (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="py-1 text-sm text-[#F3EFEA]/75">{l.label}</a>
            ) : (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="py-1 text-sm text-[#F3EFEA]/75">{l.label}</a>
            ))}
            <Link href="/observatory" onClick={() => setOpen(false)} className="mt-1 rounded-md bg-gradient-to-r from-[#C84B31] to-[#E3B341] px-4 py-2 text-center text-sm font-semibold text-[#0F1E36]">Open Observatory</Link>
          </div>
        </div>
      )}
    </header>
  );
}
