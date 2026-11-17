"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  ArrowRight,
  Sparkles,
  Zap,
  Layers,
  Eye,
  Search,
  Target,
  BarChart2,
  Users,
  Mail,
  MapPin,
  Award,
  Brain,
  Globe,
  Code,
  Star,
  Moon,
  Loader2,
  CheckCircle,
  Shield,
  Smartphone,
  Lock,
} from "lucide-react";

// Load Cormorant Garamond for the Roman-engraving hero title
const FONT_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap";
if (typeof document !== "undefined" && !document.querySelector(`link[href="${FONT_URL}"]`)) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_URL;
  document.head.append(link);
}

const GITHUB_URL = "https://github.com/KanhiChamoli/chronospectra-engine";
const INSTAGRAM_URL = "https://instagram.com/Kanhi.chamoli";
const NASA_SPACE_APPS_URL = "https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/";

function GithubIcon({ className = "", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function InstagramIcon({ className = "", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}


// Constellation art - artistic star patterns displayed throughout the page
const CONSTELLATION_PNGS = [
  { src: "/constellations/orion.png", style: { top: "-4%", right: "2%", width: "26vw", maxWidth: 400, opacity: 0.5 } },
  { src: "/constellations/ursa_major.png", style: { top: "16%", left: "-4%", width: "24vw", maxWidth: 360, opacity: 0.42 } },
  { src: "/constellations/cassiopeia.png", style: { bottom: "6%", right: "18%", width: "20vw", maxWidth: 300, opacity: 0.4 } },
  { src: "/constellations/cygnus.png", style: { bottom: "-2%", left: "6%", width: "22vw", maxWidth: 320, opacity: 0.38 } },
  { src: "/constellations/aquila.png", style: { top: "38%", left: "40%", width: "14vw", maxWidth: 210, opacity: 0.32 } },
  { src: "/constellations/leo.png", style: { top: "6%", left: "30%", width: "15vw", maxWidth: 220, opacity: 0.3 } },
];

function ConstellationArt({ variant = "default", className = "" }: { variant?: "default" | "hero" | "wide" | "compact"; className?: string }) {
  const patterns = {
    default: [
      [[10,20],[25,35],[40,15],[55,30],[70,20],[85,35]],
      [[15,60],[30,45],[45,55],[60,40],[75,50]],
    ],
    hero: [
      [[5,15],[15,25],[28,10],[42,22],[55,8],[68,18],[80,12],[92,25]],
      [[8,70],[20,55],[35,65],[50,50],[65,60],[78,45],[90,55]],
      [[12,40],[25,48],[38,35],[52,42],[60,32],[72,38]],
    ],
    wide: [
      [[2,30],[12,20],[22,35],[32,18],[45,28],[55,15],[68,25],[78,12],[88,22],[96,30]],
      [[5,70],[18,55],[30,65],[42,50],[55,60],[70,48],[82,58],[95,50]],
    ],
    compact: [
      [[15,25],[35,15],[55,30],[75,20]],
      [[20,60],[40,45],[60,55],[80,50]],
    ],
  };
  const lines = patterns[variant] || patterns.default;
  return (
    <svg className={`constellation-art-svg ${className}`} viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',opacity:0.35}}>
      <defs>
        <radialGradient id={`cg-${variant}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E3B341" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#E3B341" stopOpacity="0" />
        </radialGradient>
      </defs>
      {lines.map((pts, li) => (
        <g key={li}>
          {pts.slice(0,-1).map((p,i) => (
            <line key={i} x1={p[0]} y1={p[1]} x2={pts[i+1][0]} y2={pts[i+1][1]} stroke="#E3B341" strokeWidth="0.15" opacity="0.4" />
          ))}
          {pts.map((p,i) => (
            <g key={`s${i}`}>
              <circle cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 0.8 : 0.5} fill="#fff" opacity={0.7 + (i%3)*0.1} />
              {i % 2 === 0 && <circle cx={p[0]} cy={p[1]} r="2" fill={`url(#cg-${variant})`} opacity="0.3" />}
            </g>
          ))}
        </g>
      ))}
      {/* scattered accent stars */}
      {[[7,8],[23,72],[47,5],[63,75],[88,8],[93,68],[35,38],[78,62]].map((s,i) => (
        <circle key={`a${i}`} cx={s[0]} cy={s[1]} r={0.3 + (i%2)*0.2} fill={i%3===0?"#E3B341":"#F3EFEA"} opacity="0.5" />
      ))}
    </svg>
  );
}

function ConstellationArtLayered({ variant = "default", className = "" }: { variant?: "default" | "hero" | "wide" | "compact"; className?: string }) {
  return (
    <>
      <div className="absolute inset-0" aria-hidden="true">
        {CONSTELLATION_PNGS.map((c) => (
          <img
            key={c.src}
            src={c.src}
            alt=""
            className="constellation-png"
            style={c.style as React.CSSProperties}
            loading="lazy"
          />
        ))}
      </div>
      <ConstellationArt variant={variant} className={className} />
    </>
  );
}

function SpherexModel() {
  const [mode, setMode] = useState<"outside" | "inside" | "panels">("outside");
  const caption = {
    outside: "Drag-free orbit view — SPHEREx's three cryogenic telescope tubes sit behind the photon shield.",
    inside: "Interior view — spectrometer grating arrays and H2–4 K detector columns for the six arrays (D1–D6).",
    panels: "Solar array configuration — two gallium-ar senide wings track the Sun while the payload stays cold.",
  }[mode];
  return (
    <div className="spherex-scene">
      <div className={`spherex-model ${mode === "panels" ? "spherex-panels-on" : ""} ${mode === "inside" ? "paused" : ""}`}>
        <div className={`spherex-bus ${mode === "inside" ? "bus-interior" : ""}`} />
        <div className="spherex-shield" />
        <div className="spherex-shield shadow" />
        <div className="spherex-panel left" />
        <div className="spherex-panel right" />
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div className="spherex-controls">
          <button className={mode === "outside" ? "active" : ""} onClick={() => setMode("outside")}>Orbit View</button>
          <button className={mode === "inside" ? "active" : ""} onClick={() => setMode("inside")}>Inspect Inside</button>
          <button className={mode === "panels" ? "active" : ""} onClick={() => setMode("panels")}>Solar Panels</button>
        </div>
        <p className="spherex-caption">{caption}</p>
      </div>
    </div>
  );
}

function SkyCompare() {
  const [pos, setPos] = useState(52);
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
      className="sky-compare"
      onPointerDown={(e) => { dragging.current = true; move(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; }}
    >
      <img className="sky-compare-layer" src="/sky/gaia-visible.jpg" alt="Whole sky in visible light (Gaia)" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <img className="sky-compare-layer" src="/sky/spherex-infrared.jpg" alt="Whole sky in infrared (SPHEREx)" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
      <span className="sky-compare-tag left">GAIA · VISIBLE</span>
      <span className="sky-compare-tag right">SPHEREx · INFRARED</span>
      <div className="sky-compare-handle" style={{ left: `${pos}%` }} />
    </div>
  );
}

function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        setWidth(rect.width);
        setHeight(rect.height);
        initParticles();
      }
    };

    const initParticles = () => {
      const count = Math.min(200, Math.floor((width * height) / 3000));
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.7 ? "#48CAE4" : Math.random() > 0.5 ? "#E3B341" : "#F3EFEA",
      }));
    };

    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x * window.devicePixelRatio, p.y * window.devicePixelRatio, p.size * window.devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x * window.devicePixelRatio, p.y * window.devicePixelRatio, (p.size + 2) * window.devicePixelRatio, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity * 0.1;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x * window.devicePixelRatio, p1.y * window.devicePixelRatio);
            ctx.lineTo(p2.x * window.devicePixelRatio, p2.y * window.devicePixelRatio);
            ctx.strokeStyle = `rgba(227, 179, 65, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5 * window.devicePixelRatio;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

function AnimatedCounter({ target, suffix = "", duration = 2000, delay = 0 }: { target: number; suffix?: string; duration?: number; delay?: number }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  useEffect(() => {
    if (!isVisible) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return <span ref={ref} className="font-mono text-4xl md:text-5xl lg:text-6xl font-bold text-[#F3EFEA] tabular-nums">{count.toLocaleString()}{suffix}</span>;
}

function NavLink({ href, children, external = false, onClick }: { href: string; children: React.ReactNode; external?: boolean; onClick?: () => void }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className="text-[13px] text-[#F3EFEA]/70 hover:text-[#F3EFEA] transition-colors flex items-center gap-1"
    >
      {children}
      {external && <ExternalLink className="w-3 h-3" />}
    </a>
  );
}

function CTAButton({
  children,
  variant = "primary",
  className = "",
  as: Component = "button",
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  as?: React.ElementType;
} & Record<string, unknown>) {
  const baseStyles = "inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0F1E36]";
  const variants = {
    primary: "bg-gradient-to-r from-[#C84B31] to-[#E3B341] text-[#0F1E36] hover:brightness-110 hover:shadow-[0_0_28px_rgba(227,179,65,0.25)] focus:ring-[#E3B341]",
    secondary: "bg-[#C84B31] text-[#F3EFEA] hover:bg-[#E05A47] hover:shadow-[0_0_28px_rgba(200,75,49,0.25)] focus:ring-[#E3B341]",
    ghost: "bg-transparent border border-[#F3EFEA]/15 text-[#F3EFEA]/85 hover:border-[#E3B341] hover:text-[#E3B341] hover:bg-[#48CAE4]/5 focus:ring-[#E3B341]",
  };
  return <Component className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>{children}</Component>;
}

function Badge({ children, className = "", style, ...props }: { children: React.ReactNode; className?: string; style?: React.CSSProperties } & Record<string, unknown>) {
  return (
    <span style={style} className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-[#F3EFEA]/15 bg-[#F3EFEA]/[0.03] text-[#F3EFEA]/75 ${className}`} {...props}>
      {children}
    </span>
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${className}`} aria-label="Chronospectra home">
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#48CAE4] to-[#1C2541] flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#0F1E36]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="7.5" />
          <path d="M2.5 15.5C7 6.5 15 4 21.5 9" />
          <path d="m18.7 6.7 2.8 2.4-3.5.7" />
          <circle className="brand-star" cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#E3B341]/30 to-transparent animate-pulse" />
      </div>
      <span className="font-mono font-semibold text-xl tracking-wider text-[#F3EFEA]">CHRONO<span className="text-[#48CAE4]">SPECTRA</span></span>
    </Link>
  );
}

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0F1E36]/95 backdrop-blur-md border-b border-[#F3EFEA]/10" : "bg-transparent"}`}>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 lg:h-20 items-center justify-between">
          <Logo />

          <div className="hidden lg:flex lg:items-center lg:gap-8">
            <NavLink href="#about">About</NavLink>
            <NavLink href="#team">102 Bands</NavLink>
            <NavLink href={NASA_SPACE_APPS_URL} external>
              NASA Space Apps 2026
            </NavLink>
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="p-2 text-[#F3EFEA]/65 hover:text-[#E3B341] transition-colors" aria-label="GitHub repository">
              <GithubIcon className="w-5 h-5" />
            </a>
            <CTAButton variant="primary" as={Link} href="/observatory">
              Step into the Observatory
            </CTAButton>
          </div>

          <button
            className="lg:hidden p-2 text-[#F3EFEA]/75 hover:text-[#E3B341] transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <Moon className="w-6 h-6" /> : <Star className="w-6 h-6" />}
          </button>
        </div>

        <div id="mobile-menu" className={`lg:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? "max-h-96 opacity-100 pb-6" : "max-h-0 opacity-0"}`}>
          <div className="flex flex-col gap-4 pt-4">
            <NavLink href="#about" onClick={() => setMobileMenuOpen(false)}>About</NavLink>
            <NavLink href="#team" onClick={() => setMobileMenuOpen(false)}>102 Bands</NavLink>
            <NavLink href={NASA_SPACE_APPS_URL} external onClick={() => setMobileMenuOpen(false)}>
              NASA Space Apps 2026
            </NavLink>
            <div className="flex flex-col gap-3 pt-4 border-t border-[#F3EFEA]/10">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-[#F3EFEA]/75 hover:text-[#E3B341] hover:bg-[#F3EFEA]/[0.03] rounded-lg transition-all">
                <GithubIcon className="w-5 h-5" />
                GitHub Repository
              </a>
              <CTAButton variant="primary" className="w-full" as={Link} href="/observatory">
                Step into the Observatory
              </CTAButton>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

const ORION_SEQUENCE = {
  emerge: 600,      // Orion fades in
  kneel: 1600,      // rises/breathes into place
  spark: 2600,      // star begins to sparkle in his palm
  bloom: 3400,      // sparkle blooms into glow
  title: 4200,      // headline fades up
  subtitle: 5000,   // paragraph follows
  cta: 5600,        // buttons appear
};

function Hero({ onEnter }: { onEnter?: () => void }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), ORION_SEQUENCE.emerge),
      setTimeout(() => setPhase(2), ORION_SEQUENCE.kneel),
      setTimeout(() => setPhase(3), ORION_SEQUENCE.spark),
      setTimeout(() => setPhase(4), ORION_SEQUENCE.bloom),
      setTimeout(() => setPhase(5), ORION_SEQUENCE.title),
      setTimeout(() => setPhase(6), ORION_SEQUENCE.subtitle),
      setTimeout(() => setPhase(7), ORION_SEQUENCE.cta),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0F1E36] pt-16 lg:pt-20">
      <StarfieldBackground />
      {/* cinematic interstellar-style nebula haze */}
      <div className="absolute inset-0 hero-nebula opacity-70" aria-hidden="true" /><div className="pointer-events-none absolute -left-[15%] top-[15%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle,rgba(200,75,49,0.16)_0%,rgba(227,179,65,0.07)_35%,transparent_70%)] blur-3xl animate-pulse-slow" aria-hidden="true" /><div className="pointer-events-none absolute right-[8%] top-[28%] h-[38vmin] w-[38vmin] rounded-full bg-[radial-gradient(circle,rgba(15,30,54,0)_0%,rgba(72,202,228,0.10)_40%,rgba(227,179,65,0.05)_60%,transparent_72%)] blur-2xl animate-[spin_90s_linear_infinite]" aria-hidden="true" />
      <ConstellationArtLayered variant="hero" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1E36]/20 via-transparent to-[#0F1E36]" />

      {/* Orion figure, kneeling on the left, palm star sparkling */}
      <div className={`absolute inset-0 z-[1] transition-opacity duration-[2000ms] ${phase >= 1 ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
        <img src="/constellations/orion-hero.png" alt="" className="absolute right-[-8%] top-1/2 h-[120%] w-auto max-w-none -translate-y-1/2 object-contain opacity-30 mix-blend-screen sm:right-[-2%] sm:opacity-40 lg:right-[3%] lg:h-[130%] lg:opacity-50" style={{filter:"saturate(1.05) brightness(1.1) drop-shadow(0 0 50px rgba(227,179,65,0.12))"}} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F1E36] via-[#0F1E36]/75 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#0F1E36] via-transparent to-[#0F1E36]/30" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center max-w-4xl mx-auto">
          {phase >= 5 && (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] backdrop-blur-md text-[#F3EFEA]/80 text-[10px] font-mono tracking-[0.2em] mb-8 animate-fade-in-up">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E3B341] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E3B341]" />
                </span>
                NASA SPACE APPS CHALLENGE 2026 · SPHEREx INFRARED SUITE
              </div>

              <h1 className="hero-title font-serif text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.08] mb-8 text-[#F3EFEA]">
                Explore the dynamic
                <br />
                <span className="relative">
                  <span className="relative z-10 bg-gradient-to-r from-[#E3B341] via-[#F4D35E] to-[#C84B31] bg-clip-text text-transparent">
                    infrared universe
                  </span>
                  
                </span>
                <br />
                across 102 colors
              </h1>
            </>
          )}

          {phase >= 6 && (
            <p className="text-lg sm:text-xl lg:text-2xl text-[#F3EFEA]/75 max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in-up">
              Aligning telescope visits across 102 infrared colors, detecting motion against Gaia DR3,
              stacking exposures to reach deeper — revealing the variable and moving universe hidden in SPHEREx data.
            </p>
          )}

          {phase >= 7 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up">
              <CTAButton variant="primary" as={Link} href="/observatory" onClick={onEnter} className="w-full sm:w-auto px-8 py-4 text-base">
                Step into the Observatory
                <ArrowRight className="w-5 h-5" />
              </CTAButton>
              <CTAButton variant="ghost" as={Link} href="/pitch-deck" className="w-full sm:w-auto px-8 py-4 text-base">
                Watch the 30s Demo
              </CTAButton>
            </div>
          )}

          {phase >= 7 && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#F3EFEA]/50 animate-fade-in-up">
              <Badge><Lock className="w-3 h-3" /> Free, no sign-up</Badge>
              <Badge><Smartphone className="w-3 h-3" /> Works on phones</Badge>
              <Badge><Code className="w-3 h-3" /> Open source</Badge>
              <Badge><Shield className="w-3 h-3" /> NASA/IPAC IRSA data</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
        <svg className="w-6 h-6 text-[#F3EFEA]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}

function Metrics() {
  const metrics = [
    { label: "Infrared color channels (SPHEREx survey)", value: 102, suffix: "", icon: Layers },
    { label: "Challenge preset targets, precomputed", value: 5, suffix: "", icon: Target },
    { label: "Multi-epoch visits per preset field", value: 6, suffix: "", icon: Search },
    { label: "Detector arrays covered (D1-D6)", value: 6, suffix: "", icon: ArrowRight },
  ];

  return (
    <section id="metrics" className="relative py-20 lg:py-28 bg-[#0F1E36]/50 border-y border-[#F3EFEA]/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="relative p-6 lg:p-8 rounded-2xl bg-[#F3EFEA]/[0.03] border border-[#F3EFEA]/10 hover:border-[#48CAE4]/30 transition-all duration-300 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#48CAE4]/5 via-transparent to-[#C84B31]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              <div className="relative flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-[#48CAE4]/10 border border-[#48CAE4]/20 group-hover:border-[#E3B341]/50 transition-colors">
                  <metric.icon className="w-6 h-6 text-[#48CAE4]" />
                </div>
              </div>
              <AnimatedCounter target={metric.value} suffix={metric.suffix} duration={2500} delay={index * 200} />
              <p className="mt-2 text-sm text-[#F3EFEA]/65 font-medium">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function ObservatoryShowcase() {
  const capabilities = [
    { title: "8' Cutout Inspector", desc: "Blink, Diff, and Stack multi-epoch SPHEREx visits at detector-pixel resolution. Watch stars shift across frames with asinh/log/linear stretch.", icon: "🔭", tag: "New" },
    { title: "Gaia DR3 Cross-Match", desc: "Real astrometric verification with per-visit residuals, proper-motion vectors in ″/yr, and automatic candidate triage.", icon: "🛰️", tag: "New" },
    { title: "Light Curves & R=40 Spectra", desc: "Multi-exposure photometry by D1-D6 detectors and inverse-variance binned 102-channel spectra with H2O/CO2 ice markers.", icon: "📈", tag: "New" },
    { title: "Planet X Shift-Stack", desc: "Velocity-aligned coaddition to boost sub-threshold candidates. Drag µ/PA sliders and watch SNR snap into focus.", icon: "🪐", tag: "New" },
    { title: "Solar System Filter", desc: "SkyBoT/JPL ephemeris checks flag known asteroids and KBOs as false positives before you claim a discovery.", icon: "☄️", tag: "New" },
    { title: "Discovery Packets", desc: "Export reproducible JSON+CSV bundles with coordinates, Gaia residuals, photometry, spectra, and shareable deep-links.", icon: "📦", tag: "New" },
  ];
  return (
    <section id="observatory-capabilities" className="relative py-20 lg:py-28 bg-[#0F1E36] overflow-hidden">
      <ConstellationArtLayered variant="wide" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1E36]/80 via-[#0F1E36]/60 to-[#0F1E36]/80" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="mb-4" style={{ background: "rgba(72,202,228,0.1)", borderColor: "rgba(72,202,228,0.3)" }}>
            <Sparkles className="w-3 h-3" /> Observatory Tools
          </Badge>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#F3EFEA] mb-6">
            Discovery-grade
            <span className="bg-gradient-to-r from-[#48CAE4] to-[#E3B341] bg-clip-text text-transparent"> analysis suite</span>
          </h2>
          <p className="text-lg text-[#F3EFEA]/65">From all-sky browsing to pixel-level cutout inspection, astrometric verification, and reproducible discovery export — all in your browser.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((c) => (
            <div key={c.title} className="relative p-6 rounded-2xl bg-[#F3EFEA]/[0.04] border border-[#F3EFEA]/10 hover:border-[#48CAE4]/40 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{c.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#48CAE4] bg-[#48CAE4]/10 border border-[#48CAE4]/30 px-2 py-0.5 rounded-full">{c.tag}</span>
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#F3EFEA] mb-2 group-hover:text-[#E3B341] transition-colors">{c.title}</h3>
              <p className="text-sm text-[#F3EFEA]/65 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <CTAButton variant="primary" as={Link} href="/observatory" className="px-8 py-4 text-base">
            Step into the Observatory <ArrowRight className="w-5 h-5" />
          </CTAButton>
          <p className="text-xs text-[#F3EFEA]/50 mt-3">5 challenge presets · 20-step voice-guided tour · no sign-in required</p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Ask the Archive",
      description: "Query the SPHEREx HiPS layer and QR3 pixel-level spectra across 102 near-infrared bands. Select any sky coordinate or search known targets from our curated catalog.",
      icon: Search,
      color: "text-[#48CAE4]",
      bgColor: "bg-[#48CAE4]/10 border-[#48CAE4]/20",
    },
    {
      number: "02",
      title: "Line Everything Up",
      description: "WCS-align multi-epoch visits, cross-match with Gaia DR3 for proper motion correction, and normalize photometry across detector bands using magnitude zeropoints.",
      icon: Target,
      color: "text-[#E3B341]",
      bgColor: "bg-[#E3B341]/10 border-[#E3B341]/20",
    },
    {
      number: "03",
      title: "Blink & Check",
      description: "Flipbook-compare epochs, subtract visits to isolate changes, stack exposures for depth. Automated screening flags movers, variables, and extremely red sources.",
      icon: Eye,
      color: "text-[#C84B31]",
      bgColor: "bg-[#C84B31]/10 border-[#C84B31]/20",
    },
    {
      number: "04",
      title: "Verify & Share",
      description: "Validate candidates against SIMBAD, TIC, and Gaia catalogs. Export light curves, spectra, and cutouts. Generate reproducible analysis links for collaboration.",
      icon: CheckCircle,
      color: "text-[#48CAE4]",
      bgColor: "bg-[#48CAE4]/10 border-[#48CAE4]/20",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 lg:py-28 bg-[#0F1E36]">
      <StarfieldBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1E36] via-[#0F1E36]/60 to-[#0F1E36]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="mb-4" style={{ background: "rgba(72, 202, 228, 0.1)", borderColor: "rgba(72, 202, 228, 0.3)" }}>
            <Sparkles className="w-3 h-3" /> How It Works
          </Badge>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#F3EFEA] mb-6">
            From photons to
            <span className="bg-gradient-to-r from-[#48CAE4] to-[#E3B341] bg-clip-text text-transparent"> discoveries</span>
            in four steps
          </h2>
          <p className="text-lg text-[#F3EFEA]/65">
            A streamlined pipeline that turns raw SPHEREx observations into scientifically validated candidates — no local compute required.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative p-6 lg:p-8 rounded-2xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] backdrop-blur-md group transition-all duration-300 hover:border-[#F3EFEA]/20 hover:shadow-[0_0_30px_rgba(227,179,65,0.08)]"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: step.color.replace("text-", "") }} />
              <div className="relative flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: step.bgColor.replace("bg-", "bg-").replace("/10", "/20"), borderColor: step.color.replace("text-", "") }}>
                  <span className="font-mono font-semibold text-2xl" style={{ color: step.color.replace("text-", "") }}>{step.number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <step.icon className="w-5 h-5" style={{ color: step.color.replace("text-", "") }} />
                    <h3 className="font-serif text-xl font-semibold text-[#F3EFEA]">{step.title}</h3>
                  </div>
                  <p className="text-[#F3EFEA]/75 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ title, description, icon: Icon, features, color, bgColor, borderColor, style }: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style} className="relative p-6 lg:p-8 rounded-2xl bg-[#F3EFEA]/[0.03] border border-[#F3EFEA]/10 group transition-all duration-300 hover:border-[#48CAE4]/30 hover:shadow-[0_0_30px_rgba(72,202,228,0.05)]">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-transparent group-hover:from-[#48CAE4]/5 group-hover:to-[#C84B31]/5 transition-all duration-500 rounded-2xl" />
      <div className="relative flex items-start gap-4 mb-6">
        <div className={`flex-shrink-0 p-3 rounded-xl ${bgColor} border ${borderColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div>
          <h3 className="font-serif text-xl font-semibold text-[#F3EFEA] mb-2">{title}</h3>
          <p className="text-[#F3EFEA]/65">{description}</p>
        </div>
      </div>
      <ul className="space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-[#F3EFEA]/75 group-hover:text-[#F3EFEA]/90 transition-colors">
            <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full" style={{ backgroundColor: color.replace("text-", "") }} />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Features() {
  const featureGroups = [
    {
      title: "Core Analysis Modes",
      features: [
        {
          title: "Blink Between Visits",
          description: "Flipbook-style temporal comparison of multi-epoch observations",
          icon: Eye,
          features: ["Side-by-side epoch comparison", "Adjustable blink speed", "Synchronized WCS alignment", "Difference overlay toggle"],
          color: "text-[#48CAE4]",
          bgColor: "bg-[#48CAE4]/10",
          borderColor: "border-[#48CAE4]/20",
        },
        {
          title: "Difference / Diff Mode",
          description: "Subtract visits to isolate variable flux and moving sources",
          icon: Zap,
          features: ["Pixel-level image subtraction", "Significance mapping (σ)", "Automatic artifact rejection", "Residual visualization"],
          color: "text-[#C84B31]",
          bgColor: "bg-[#C84B31]/10",
          borderColor: "border-[#C84B31]/20",
        },
        {
          title: "Stack Mode",
          description: "Co-add exposures to reach deeper limiting magnitudes",
          icon: Layers,
          features: ["Inverse-variance weighting", "Outlier rejection (sigma-clipping)", "S/N improvement tracking", "Depth estimation per band"],
          color: "text-[#E3B341]",
          bgColor: "bg-[#E3B341]/10",
          borderColor: "border-[#E3B341]/20",
        },
        {
          title: "Multi-Band Selector",
          description: "Switch between 102 SPHEREx detector bands (0.75–5.0 µm)",
          icon: Target,
          features: ["Interactive band picker", "Wavelength coverage display", "Band-specific zeropoints", "SED construction across epochs"],
          color: "text-[#C84B31]",
          bgColor: "bg-[#D5C5A8]/10",
          borderColor: "border-[#D5C5A8]/20",
        },
      ],
    },
    {
      title: "Automated Discovery",
      features: [
        {
          title: "Automated Findings",
          description: "ML-assisted screening for movers, variables, and red sources",
          icon: Brain,
          features: ["Proper motion detection vs Gaia", "Variability significance testing", "Extremely red source identification", "Candidate ranking by S/N"],
          color: "text-[#48CAE4]",
          bgColor: "bg-[#48CAE4]/10",
          borderColor: "border-[#48CAE4]/20",
        },
        {
          title: "Light Curves & Spectra",
          description: "Time-series photometry and spectral energy distributions",
          icon: BarChart2,
          features: ["Multi-epoch light curves", "SED fitting and modeling", "Periodogram analysis", "Flux calibration per epoch"],
          color: "text-[#48CAE4]",
          bgColor: "bg-[#48CAE4]/10",
          borderColor: "border-[#48CAE4]/20",
        },
        {
          title: "Verification Tables",
          description: "Cross-match against Gaia, SIMBAD, TIC, and 2MASS",
          icon: Search,
          features: ["Gaia DR3 proper motion check", "SIMBAD classification lookup", "TIC/2MASS photometry", "Contamination probability"],
          color: "text-[#C84B31]",
          bgColor: "bg-[#E3B341]/10",
          borderColor: "border-[#E3B341]/20",
        },
      ],
    },
  ];

  return (
    <section id="features" className="relative py-20 lg:py-28 bg-[#0F1E36]/50 border-y border-[#F3EFEA]/10 overflow-hidden">
      <ConstellationArtLayered variant="default" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="mb-4" style={{ background: "rgba(227, 179, 65, 0.1)", borderColor: "rgba(227, 179, 65, 0.3)" }}>
            <Zap className="w-3 h-3" /> Feature Highlights
          </Badge>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#F3EFEA] mb-6">
            Tools built for
            <span className="bg-gradient-to-r from-[#E3B341] to-[#48CAE4] bg-clip-text text-transparent"> discovery</span>
          </h2>
          <p className="text-lg text-[#F3EFEA]/65">
            Every feature designed to turn raw infrared time-series into publishable science — from first blink to final verification.
          </p>
        </div>

        {featureGroups.map((group, groupIndex) => (
          <div key={group.title} className="mb-16 lg:mb-20">
            <h3 className="font-serif text-2xl font-semibold text-[#F3EFEA] mb-8 flex items-center gap-3">
              <span className="font-mono text-[#48CAE4]">{String(groupIndex + 1).padStart(2, "0")}</span>
              {group.title}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {group.features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  {...feature}
                  style={{ animationDelay: `${(groupIndex * 4 + index) * 100}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Team() {
  const teamMembers = [
    {
      name: "Kanhi Chamoli",
      role: "Founder & Lead Developer",
      description: "Aspiring computational astrophysicist (Grade 10, Bangalore). Building AstroRecon for ISEF. Top 16th percentile in SIN Physics Waterloo Exam (World Rank 212). IAAC Pre-Finalist. Recognized by Prof. Annapurni Subramaniam, Director of IIA.",
      quote: '"Making the Invisible Universe visible to the human eye in more than just one perspective."',
      links: [
        { icon: GithubIcon, href: "https://github.com/KanhiChamoli", label: "GitHub" },
        { icon: InstagramIcon, href: "https://instagram.com/Kanhi.chamoli", label: "Instagram" },
      ],
      gradient: "from-[#48CAE4] to-[#1C2541]",
    },
  ];

  return (
    <section id="team" className="relative py-20 lg:py-28 bg-[#0F1E36]">
      <StarfieldBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1E36] via-[#0F1E36]/60 to-[#0F1E36]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(72,202,228,0.05),transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="mb-4" style={{ background: "rgba(227, 179, 65, 0.1)", borderColor: "rgba(227, 179, 65, 0.3)" }}>
            <Users className="w-3 h-3" /> Made By
          </Badge>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#F3EFEA] mb-6">
            A mission driven by
            <span className="bg-gradient-to-r from-[#E3B341] to-[#48CAE4] bg-clip-text text-transparent"> curiosity</span>
          </h2>
          <p className="text-lg text-[#F3EFEA]/65">
            Built by a student astrophysicist bridging code, art, and visualization to make science accessible to everyone.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {teamMembers.map((member) => (
            <div key={member.name} className="relative p-8 lg:p-10 rounded-3xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] backdrop-blur-md group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#48CAE4]/5 via-transparent to-[#C84B31]/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#48CAE4] via-[#E3B341] to-cyan-500" />

              <div className="relative flex items-start gap-6">
                <div className="flex-shrink-0 relative">
                  <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-2xl bg-gradient-to-br flex items-center justify-center text-4xl lg:text-5xl font-semibold text-[#0F1E36]" style={{ background: member.gradient }}>
                    K
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-[#48CAE4] border-4 border-[#0F1E36] animate-pulse" />
                </div>

                <div className="flex-1 min-w-0 pt-2">
                  <div className="flex items-baseline gap-3 mb-3">
                    <h3 className="font-serif text-2xl lg:text-3xl font-semibold text-[#F3EFEA]">{member.name}</h3>
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#48CAE4]/15 text-[#48CAE4] border border-[#48CAE4]/30">
                      Grade 10
                    </span>
                  </div>
                  <p className="text-[#E3B341] font-medium mb-4">{member.role}</p>
                  <p className="text-[#F3EFEA]/75 mb-6 leading-relaxed text-sm lg:text-base">{member.description}</p>

                  <blockquote className="relative pl-6 border-l-2 border-[#E3B341]/50 my-6">
                    <p className="text-[#F3EFEA]/85 italic text-base lg:text-lg leading-relaxed">{member.quote}</p>
                  </blockquote>

                  <div className="flex flex-wrap gap-3">
                    {member.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F3EFEA]/[0.04] border border-[#F3EFEA]/15 text-[#F3EFEA]/75 hover:border-[#E3B341] hover:text-[#E3B341] hover:bg-[#48CAE4]/10 transition-all duration-200 text-sm"
                      >
                        <link.icon className="w-4 h-4" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <CTAButton variant="ghost" as={Link} href="https://github.com/KanhiChamoli/chronospectra-engine/graphs/contributors" target="_blank" rel="noopener noreferrer" className="px-8 py-4 text-base">
            View All Contributors
            <ArrowRight className="w-5 h-5" />
          </CTAButton>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    about: "",
    message: "",
    website: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email format";
    if (!formData.about) newErrors.about = "Please select a topic";
    if (!formData.message.trim()) newErrors.message = "Message is required";
    if (formData.website.trim() && !/^https?:\/\//.test(formData.website)) newErrors.website = "Please include https://";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("submitting");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setStatus("success");
    setFormData({ name: "", email: "", about: "", message: "", website: "" });
    setTimeout(() => setStatus("idle"), 5000);
  };

  const aboutOptions = [
    { value: "question", label: "General Question" },
    { value: "feedback", label: "Feedback / Bug Report" },
    { value: "collaboration", label: "Collaboration / Research" },
    { value: "press", label: "Press / Media Inquiry" },
    { value: "other", label: "Other" },
  ];

  return (
    <section id="contact" className="relative py-20 lg:py-28 bg-[#0F1E36]/50 border-y border-[#F3EFEA]/10 overflow-hidden">
      <ConstellationArt variant="compact" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <Badge className="mb-4" style={{ background: "rgba(72, 202, 228, 0.1)", borderColor: "rgba(72, 202, 228, 0.3)" }}>
              <Mail className="w-3 h-3" /> Get In Touch
            </Badge>
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#F3EFEA] mb-6">
              Send a
              <span className="bg-gradient-to-r from-[#48CAE4] to-[#E3B341] bg-clip-text text-transparent"> message</span>
            </h2>
            <p className="text-lg text-[#F3EFEA]/65 mb-8">
              Have questions about the pipeline? Found an interesting candidate? Want to collaborate?
              We&apos;d love to hear from you.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F3EFEA]/[0.03] border border-[#F3EFEA]/10 backdrop-blur-md">
                <div className="p-3 rounded-xl bg-[#48CAE4]/10 border border-[#48CAE4]/20">
                  <Mail className="w-6 h-6 text-[#48CAE4]" />
                </div>
                <div>
                  <p className="text-sm text-[#F3EFEA]/50">Email</p>
                  <a href="mailto:kanhi.chamoli@example.com" className="text-[#F3EFEA] hover:text-[#E3B341] transition-colors">kanhi.chamoli@example.com</a>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F3EFEA]/[0.03] border border-[#F3EFEA]/10 backdrop-blur-md">
                <div className="p-3 rounded-xl bg-[#E3B341]/10 border border-[#E3B341]/20">
                  <MapPin className="w-6 h-6 text-[#E3B341]" />
                </div>
                <div>
                  <p className="text-sm text-[#F3EFEA]/50">Location</p>
                  <p className="text-[#F3EFEA]">Bangalore, India</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F3EFEA]/[0.03] border border-[#F3EFEA]/10 backdrop-blur-md">
                <div className="p-3 rounded-xl bg-[#D5C5A8]/10 border border-[#D5C5A8]/20">
                  <Globe className="w-6 h-6 text-[#C84B31]" />
                </div>
                <div>
                  <p className="text-sm text-[#F3EFEA]/50">Project</p>
                  <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-[#F3EFEA] hover:text-[#E3B341] transition-colors">GitHub Repository</a>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative p-8 lg:p-10 rounded-3xl border border-[#F3EFEA]/10 bg-[#F3EFEA]/[0.03] backdrop-blur-md" noValidate>
            <div className="absolute inset-0 bg-gradient-to-br from-[#48CAE4]/5 via-transparent to-[#C84B31]/5 rounded-3xl" />
            <div className="relative space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-[#F3EFEA]/75 mb-2">
                    Name <span className="text-[#C84B31]">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-3 rounded-lg bg-[#F3EFEA]/[0.04] border ${
                      errors.name ? "border-[#C84B31]" : "border-[#F3EFEA]/15 focus:border-[#E3B341]"
                    } text-[#F3EFEA] placeholder-[#F3EFEA]/40 focus:outline-none focus:ring-2 focus:ring-[#E3B341]/20 transition-colors`}
                    placeholder="Your name"
                    aria-invalid={errors.name ? "true" : "false"}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                  {errors.name && <p id="name-error" className="mt-1 text-sm text-[#C84B31]">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#F3EFEA]/75 mb-2">
                    Email <span className="text-[#C84B31]">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-3 rounded-lg bg-[#F3EFEA]/[0.04] border ${
                      errors.email ? "border-[#C84B31]" : "border-[#F3EFEA]/15 focus:border-[#E3B341]"
                    } text-[#F3EFEA] placeholder-[#F3EFEA]/40 focus:outline-none focus:ring-2 focus:ring-[#E3B341]/20 transition-colors`}
                    placeholder="you@example.com"
                    aria-invalid={errors.email ? "true" : "false"}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && <p id="email-error" className="mt-1 text-sm text-[#C84B31]">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="about" className="block text-sm font-medium text-[#F3EFEA]/75 mb-2">
                  About <span className="text-[#C84B31]">*</span>
                </label>
                <select
                  id="about"
                  name="about"
                  value={formData.about}
                  onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                  className={`w-full px-4 py-3 rounded-lg bg-[#F3EFEA]/[0.04] border ${
                    errors.about ? "border-[#C84B31]" : "border-[#F3EFEA]/15 focus:border-[#E3B341]"
                  } text-[#F3EFEA] focus:outline-none focus:ring-2 focus:ring-[#E3B341]/20 transition-colors appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%2300f0ff%22 stroke-width=%221.5%22%3E%3Cpath d=%22M19 9l-7 7-7-7%22/%3E%3C/svg%3E')] bg-[right_1rem_center] bg-no-repeat pr-10`}
                  aria-invalid={errors.about ? "true" : "false"}
                  aria-describedby={errors.about ? "about-error" : undefined}
                >
                  <option value="">Select a topic</option>
                  {aboutOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.about && <p id="about-error" className="mt-1 text-sm text-[#C84B31]">{errors.about}</p>}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-[#F3EFEA]/75 mb-2">
                  Message <span className="text-[#C84B31]">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                  className={`w-full px-4 py-3 rounded-lg bg-[#F3EFEA]/[0.04] border ${
                    errors.message ? "border-[#C84B31]" : "border-[#F3EFEA]/15 focus:border-[#E3B341]"
                  } text-[#F3EFEA] placeholder-[#F3EFEA]/40 focus:outline-none focus:ring-2 focus:ring-[#E3B341]/20 transition-colors resize-y min-h-[120px] font-mono text-sm`}
                  placeholder="Tell us what&apos;s on your mind..."
                  aria-invalid={errors.message ? "true" : "false"}
                  aria-describedby={errors.message ? "message-error" : undefined}
                />
                {errors.message && <p id="message-error" className="mt-1 text-sm text-[#C84B31]">{errors.message}</p>}
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-[#F3EFEA]/75 mb-2">
                  Website (optional)
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className={`w-full px-4 py-3 rounded-lg bg-[#F3EFEA]/[0.04] border ${
                    errors.website ? "border-[#C84B31]" : "border-[#F3EFEA]/15 focus:border-[#E3B341]"
                  } text-[#F3EFEA] placeholder-[#F3EFEA]/40 focus:outline-none focus:ring-2 focus:ring-[#E3B341]/20 transition-colors`}
                  placeholder="https://your-website.com"
                  aria-invalid={errors.website ? "true" : "false"}
                  aria-describedby={errors.website ? "website-error" : undefined}
                />
                {errors.website && <p id="website-error" className="mt-1 text-sm text-[#C84B31]">{errors.website}</p>}
              </div>

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full px-6 py-4 rounded-lg font-semibold text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0F1E36] disabled:opacity-50 disabled:cursor-not-allowed
                  bg-gradient-to-r from-[#48CAE4] to-[#1C2541] text-[#0F1E36] hover:from-[#48CAE4] hover:to-blue-500 hover:shadow-[0_0_28px_rgba(227,179,65,0.25)] focus:ring-[#E3B341]"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Sending...
                  </>
                ) : status === "success" ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Message Sent!
                  </>
                ) : (
                  "Send Message"
                )}
              </button>

              <p className="text-center text-xs text-[#F3EFEA]/50">
                We store your name, email, and message only to reply. No analytics, no tracking, no spam.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const footerLinks = {
    "The Project": [
      { label: "The Tool", href: "/observatory" },
      { label: "About", href: "#about" },
      { label: "102 Bands", href: "#team" },
      { label: "Contact", href: "#contact" },
      { label: "Source Code", href: GITHUB_URL, external: true },
    ],
    "Resources": [
      { label: "SPHEREx at IRSA", href: "https://irsa.ipac.caltech.edu/Missions/spherex.html", external: true },
      { label: "Gaia Mission (ESA)", href: "https://www.cosmos.esa.int/gaia", external: true },
      { label: "NASA Space Apps 2026", href: NASA_SPACE_APPS_URL, external: true },
      { label: "Challenge Resources", href: "https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=resources", external: true },
    ],
    "Connect": [
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "Instagram", href: INSTAGRAM_URL, external: true },
    ],
  };

  return (
    <footer className="relative bg-[#0F1E36] border-t border-[#F3EFEA]/10">
      <StarfieldBackground />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F1E36] via-[#0F1E36]/60 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-6 text-[#F3EFEA]/65 max-w-md leading-relaxed">
              Chronospectra is an open-source astronomical data viewer for the SPHEREx all-sky survey.
              It aligns multi-epoch infrared observations across 102 bands, cross-matches with Gaia DR3,
              and provides automated screening for variable and moving sources — making the invisible universe
              visible in more than just one perspective.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge className="bg-[#1C2541] border-[#F3EFEA]/15"><Code className="w-3 h-3 mr-1" /> Open Source</Badge>
              <Badge className="bg-[#1C2541] border-[#F3EFEA]/15"><Award className="w-3 h-3 mr-1" /> NASA Space Apps 2026</Badge>
              <Badge className="bg-[#1C2541] border-[#F3EFEA]/15"><Star className="w-3 h-3 mr-1" /> Student Project</Badge>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-[#F3EFEA] mb-4">Quick Links</h4>
            <ul className="space-y-3">
              {footerLinks["The Project"].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-[#F3EFEA]/65 hover:text-[#E3B341] transition-colors text-sm flex items-center gap-1"
                  >
                    {link.label}
                    {link.external && <ExternalLink className="w-3 h-3" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[#F3EFEA] mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks["Resources"].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F3EFEA]/65 hover:text-[#E3B341] transition-colors text-sm flex items-center gap-1"
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#F3EFEA]/10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#F3EFEA]/50">
              © 2026 Chronospectra. Built by Kanhi Chamoli for NASA Space Apps Challenge.
            </p>
            <p className="text-xs text-[#F3EFEA]/40 max-w-2xl">
              Data provided by NASA/IPAC IRSA (SPHEREx DR1 HiPS) and ESA/Gaia/DPAC (Gaia DR3).
              This is a student project and not an official NASA or ESA product.
            </p>
            <div className="flex items-center gap-6">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-[#F3EFEA]/50 hover:text-[#E3B341] transition-colors" aria-label="GitHub">
                <GithubIcon className="w-5 h-5" />
              </a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-[#F3EFEA]/50 hover:text-[#E3B341] transition-colors" aria-label="Instagram">
                <InstagramIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SameSkyDifferentLight() {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <ConstellationArtLayered variant="compact" />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <Badge className="mb-4" style={{ background: "rgba(227,179,65,0.1)", borderColor: "rgba(227,179,65,0.3)" }}>
          <Eye className="w-3 h-3" /> Two eyes on one sky
        </Badge>
        <h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight text-[#F3EFEA] sm:text-5xl">
          Same sky, <span className="bg-gradient-to-r from-sky-200 to-[#E3B341] bg-clip-text text-transparent">different light.</span>
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-[#F3EFEA]/65">
          On the left, the whole sky as Gaia sees it in visible light; on the right, as SPHEREx sees it in infrared.
          Slide the handle — cold dust, newborn stars and the galactic core glow far brighter in infrared.
        </p>
        <SkyCompare />
      </div>
    </section>
  );
}

function SpherexModelSection() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <Badge className="mb-4" style={{ background: "rgba(72,202,228,0.1)", borderColor: "rgba(72,202,228,0.3)" }}>
            <Sparkles className="h-3 w-3" /> Meet the spacecraft
          </Badge>
          <h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight text-[#F3EFEA] sm:text-4xl">
            The telescope behind the data
          </h2>
          <p className="mb-4 text-[#F3EFEA]/65">
            SPHEREx scans the entire sky in 102 infrared colors from a sun-synchronous orbit,
            keeping its payload below −210 °C behind three nested photon shields.
          </p>
          <p className="text-sm text-[#F3EFEA]/50">
            Schematic model — not to scale. Switch between the orbit view, the detector interior,
            and the solar array configuration.
          </p>
        </div>
        <SpherexModel />
      </div>
    </section>
  );
}

export default function LandingPageClient() {
  const [tourPromptOpen, setTourPromptOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#0F1E36] text-[#F3EFEA] font-sans antialiased">
      <Navigation />
      <main>
        <Hero onEnter={() => setTourPromptOpen(true)} />
        <Metrics />
        <ObservatoryShowcase />
        <HowItWorks />
        <SpherexModelSection />
        <SameSkyDifferentLight />
        <Features />
        <Team />
        <Contact />
      </main>
      <Footer />
      {tourPromptOpen && <TourPromptModal onClose={() => setTourPromptOpen(false)} />}
    </div>
  );
}

function TourPromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#0B132B]/85 backdrop-blur px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Guided tour"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#48CAE4]/40 bg-[#0F1E36]/95 p-8 text-center shadow-[0_0_60px_rgba(0,240,255,0.12)]">
        <div className="mb-4 text-4xl" aria-hidden="true">🛰️</div>
        <h2 className="mb-2 font-serif text-xl font-semibold text-[#F3EFEA]">Would you like a guided tour of the observatory?</h2>
        <p className="mb-6 text-sm text-[#F3EFEA]/65">
          A 20-step field guide with voice narration walks you through presets, blink playback, Gaia verification and the spectral plots. You can skip it at any time.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/observatory?tour=1"
            className="flex-1 rounded-xl bg-[#E3B341] px-5 py-3 font-semibold text-[#0F1E36] transition hover:bg-[#F4D35E]"
          >
            Yes, show me around
          </Link>
          <Link
            href="/observatory"
            className="flex-1 rounded-xl border border-[#F3EFEA]/15 px-5 py-3 font-semibold text-[#F3EFEA]/75 transition hover:border-[#F3EFEA]/30 hover:text-[#F3EFEA]"
          >
            No, just explore
          </Link>
        </div>
        <button onClick={onClose} className="mt-4 text-xs text-[#F3EFEA]/50 hover:text-[#F3EFEA]/75">
          Cancel
        </button>
      </div>
    </div>
  );
}


