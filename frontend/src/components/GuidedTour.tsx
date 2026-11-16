"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface TourStep {
  id: string;
  title: string;
  text: string;
  target?: string; // CSS selector hint
}

const tourSteps: TourStep[] = [
  { id: "welcome", title: "Welcome to Chrono Spectra", text: "This is a discovery-grade SPHEREx multi-epoch blink comparator. Let me walk you through the key tools for finding moving stars, brown dwarfs, and variable objects in infrared sky data." },
  { id: "presets", title: "1. Challenge Presets", text: "Start with one-click NASA challenge presets. Each loads real coordinates and multi-epoch data for benchmark targets like Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, and R Draconis. Presets open instantly." },
  { id: "search", title: "2. Find Any Patch of Sky", text: "Type a position like decimal coordinates 269.45 4.75, or sexagesimal 17h 57m 48s plus 04 degrees 41 minutes, or a name like Barnard. Presets open instantly; any other spot is built live from the NASA archive in about 20 seconds." },
  { id: "view-toggle", title: "3. View Modes", text: "Switch between All-Sky WWT map, 8-arcminute Cutout Inspector, and Light Curve and SED Plots. The cutout inspector lets you zoom into detector-level pixels where moving objects are actually discovered." },
  { id: "timeline", title: "4. Multi-Visit Timeline", text: "Each frame is one SPHEREx visit, roughly six months apart. Click visit pills to jump to any epoch. The timeline shows the date and number of exposures for each observation." },
  { id: "playback", title: "5. Play the Visits", text: "Play or pause with Space, step one visit with arrow keys, and set the speed with the slider from 0.5 to 6 frames per second. Watch objects move and change across epochs." },
  { id: "blink", title: "6. Blink Mode", text: "Blink flips between visits: movers jump across pixels, variables pulse in brightness. This is the fastest way to spot proper motion and variability." },
  { id: "diff", title: "7. Diff Mode", text: "Diff subtracts a reference visit or median stack. Cyan shows brighter now, red shows brighter before, so a moving star becomes a red-cyan dipole pair. Stationary stars cancel out. Shortcut D." },
  { id: "stack", title: "8. Stack Mode", text: "Stack computes a sigma-clipped median coadd across all visits to suppress noise and reveal faint stationary sources. Use this to go deeper and find ultra-red objects." },
  { id: "stretch", title: "9. Brightness Stretch", text: "Choose asinh, log, or linear pixel intensity scaling. Asinh shows faint and bright things together. Adjust the softness slider to dig out fainter detail. Every visit uses the same scale so changes are real." },
  { id: "fov-bands", title: "10. Field of View & Detector Bands", text: "Toggle field of view between 1, 2, 8, and 15 arcminutes. Filter by All or individual SPHEREx detector bands D1 through D6, covering 0.75 to 5.0 micrometers." },
  { id: "overlays", title: "11. Overlays", text: "Toggle Gaia circles to show ESA Gaia catalogue predictions with proper motion arrows. Flags marks saturated and bad pixels. Finds marks automatically labelled sources. Planet X shows shift-stack search grid. Shortcuts: G, F, C, X." },
  { id: "gaia-check", title: "12. Gaia Proper-Motion Check", text: "The inspector compares measured positions with Gaia DR3 predictions. A checkmark means every visit agrees within tolerance. Expand per-visit offsets for detailed astrometric residuals in arcseconds and pixels." },
  { id: "candidates", title: "13. Candidate Triage", text: "Sources are automatically classified as Moving, Variable, Very Red, or Not in Gaia. Moving means proper motion above 3 sigma. Variable means flux variance above 5 sigma. Not in Gaia infrared detections are high-priority brown dwarf or Planet X candidates." },
  { id: "solar-system", title: "14. Solar System Filter", text: "The inspector checks for known asteroids and Kuiper Belt objects using SkyBoT and JPL ephemeris data. Matched objects are flagged as false positives so you don't mistake ordinary asteroids for Planet X." },
  { id: "shift-stack", title: "15. Planet X Shift-Stack", text: "In Stack mode, enable Planet X Shift-Stack to align frames along trial velocity vectors. Adjust proper motion and position angle sliders to boost faint sub-threshold candidates. The SNR readout shows improvement in real time." },
  { id: "plots", title: "16. Light Curve & Spectrum Plots", text: "Open the bottom dock to view multi-exposure light curves colored by detector D1 to D6, and single-visit R equals 40 binned spectra. Click a visit on the light curve to sync the spectrum. Hollow circles indicate saturated exposures." },
  { id: "spectrum-detail", title: "17. 102-Channel Spectrum", text: "The spectrum shows grey dots for raw single exposures, cyan line for R equals 40 weighted mean bins, and shaded regions for H2O and CO2 ice absorption bands. One visit only so variable stars don't blur." },
  { id: "observations", title: "18. My Observations & Discovery", text: "Save targets to My Observations stored locally without sign-in. Community Finds are pre-populated with curated candidates. Export Discovery Packets as JSON and CSV bundles with coordinates, photometry, and astrometric verification." },
  { id: "share", title: "19. Share Your Findings", text: "Use the Share button to copy a deep-link URL that reproduces the exact view, target, mode, band, and parameters. Judges and collaborators can open the same state instantly." },
  { id: "complete", title: "20. Ready to Explore", text: "You're ready to hunt for moving objects, variables, and brown dwarfs in SPHEREx data. Start with a preset, blink through visits, check Gaia, and export your discoveries. Good luck!" },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
}

type CourseTier = "choose" | "general" | "researcher";

const RESEARCHER_TOPICS = new Set([
  "fov-bands", "gaia-check", "stretch", "spectrum-detail", "shift-stack", "solar-system",
]);

export function GuidedTour({ isOpen, onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [course, setCourse] = useState<CourseTier>("choose");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const activeSteps = course === "researcher"
    ? tourSteps.filter((s) => RESEARCHER_TOPICS.has(s.id))
    : tourSteps;
  const currentStep = activeSteps[step];

  const pickCourse = (tier: CourseTier) => { setCourse(tier); setStep(0); };

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a British female voice
    const voices = window.speechSynthesis.getVoices();
    const britishFemale = voices.find((v) => v.lang.startsWith("en-GB") && /female|woman|zira|hazel|susan|kate|serena/i.test(v.name))
      || voices.find((v) => v.lang.startsWith("en-GB"))
      || voices.find((v) => /female/i.test(v.name) && v.lang.startsWith("en"));
    if (britishFemale) utterance.voice = britishFemale;
    utterance.lang = "en-GB";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [stopSpeaking]);

  useEffect(() => {
    if (!isOpen) { stopSpeaking(); setStep(0); setCourse("choose"); }
  }, [isOpen, stopSpeaking]);

  useEffect(() => {
    return () => stopSpeaking();
  }, [stopSpeaking]);

  if (!isOpen) return null;

  if (course === "choose") {
    return (
      <div className="tour-overlay" onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}>
        <div className="tour-card">
          <div className="tour-header">
            <span className="tour-step-count">FIELD GUIDE · COSMO THE ROBOT</span>
            <button className="tour-close" onClick={onClose}>×</button>
          </div>
          <div className="field-guide-mascot" aria-hidden="true">
            <RobotMascot />
            <p className="field-guide-greeting">Hi, I&apos;m Cosmo! Pick a course and I&apos;ll walk you through the observatory.</p>
          </div>
          <div className="field-guide-courses">
            <button className="field-guide-course" onClick={() => pickCourse("general")}>
              <span className="field-guide-icon" aria-hidden="true">✧</span>
              <strong>General course</strong>
              <span>From your first sky map to reading graphs of light. No difficult maths — all {tourSteps.length} topics.</span>
            </button>
            <button className="field-guide-course" onClick={() => pickCourse("researcher")}>
              <span className="field-guide-icon" aria-hidden="true">⌁</span>
              <strong>Researcher course</strong>
              <span>Check coordinates, raw pixels, wavelength response, uncertainties and a reproducible workflow — {activeSteps.length} focused topics.</span>
            </button>
          </div>
          <button className="tour-btn primary" style={{ width: "100%", marginTop: 14 }} onClick={() => pickCourse("general")}>Start from the beginning →</button>
        </div>
      </div>
    );
  }

  if (!currentStep) return null;

  return (
    <div className="tour-overlay" onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}>
      <div className="tour-card">
        <div className="tour-header">
          <span className="tour-step-count">{course === "researcher" ? "RESEARCHER COURSE" : "GENERAL COURSE"} · Step {step + 1} of {activeSteps.length}</span>
          <button className="tour-close" onClick={onClose}>×</button>
        </div>
        <div className="field-guide-mascot inline">
          <RobotMascot />
          <div>
            <h3 className="tour-title">{currentStep.title}</h3>
            <p className="tour-text">{currentStep.text}</p>
          </div>
        </div>
        <div className="tour-controls">
          <button className="tour-btn voice-btn" onClick={() => speaking ? stopSpeaking() : speak(`${currentStep.title}. ${currentStep.text}`)} title="Read aloud (British voice)">
            {speaking ? "⏹ Stop" : "🔊 Read Aloud"}
          </button>
          <div className="tour-nav">
            {step === 0 && course === "researcher" && (
              <button className="tour-btn" onClick={() => { stopSpeaking(); setCourse("choose"); }}>Courses</button>
            )}
            <button className="tour-btn" onClick={() => { stopSpeaking(); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>← Back</button>
            {step < activeSteps.length - 1 ? (
              <button className="tour-btn primary" onClick={() => { stopSpeaking(); setStep(step + 1); }}>Next →</button>
            ) : (
              <button className="tour-btn primary" onClick={onClose}>Finish</button>
            )}
          </div>
        </div>
        <div className="tour-progress">
          {activeSteps.map((_, i) => (
            <span key={i} className={`tour-dot${i === step ? " active" : ""}${i < step ? " done" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RobotMascot() {
  return (
    <svg className="robot-mascot" viewBox="0 0 64 64" aria-hidden="true" width="56" height="56">
      <rect x="14" y="20" width="36" height="30" rx="10" fill="rgba(0,229,255,0.10)" stroke="#00e5ff" strokeWidth="2.5" />
      <circle cx="25" cy="34" r="4" fill="#00e5ff" />
      <circle cx="39" cy="34" r="4" fill="#00e5ff" />
      <circle cx="26" cy="33" r="1.3" fill="#04101c" />
      <circle cx="40" cy="33" r="1.3" fill="#04101c" />
      <path d="M26 43 q6 4 12 0" stroke="#ffb703" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <line x1="32" y1="20" x2="32" y2="13" stroke="#00e5ff" strokeWidth="2.2" />
      <circle cx="32" cy="11" r="3" fill="#ffb703" />
      <rect x="20" y="52" width="8" height="5" rx="2" fill="rgba(0,229,255,0.35)" />
      <rect x="36" y="52" width="8" height="5" rx="2" fill="rgba(0,229,255,0.35)" />
      <path className="robot-antenna-wave" d="M38 8 q4 -3 8 0" stroke="#ffb703" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
