"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface BackgroundAudioContextValue {
  isPlaying: boolean;
  volume: number;
  playbackError: string;
  clickSoundsEnabled: boolean;
  clickSoundError: string;
  toggleMusic: () => void;
  toggleClickSounds: () => void;
  setVolume: (volume: number) => void;
}

const BackgroundAudioContext = createContext<BackgroundAudioContextValue | null>(null);
const PLAYING_STORAGE_KEY = "chronospectra-music-playing";
const VOLUME_STORAGE_KEY = "chronospectra-music-volume";
const CLICK_SOUNDS_STORAGE_KEY = "chronospectra-click-sounds-enabled";

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function BackgroundAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasInteracted = useRef(false);
  const desiredPlaying = useRef(true);
  const clickSoundsEnabledRef = useRef(true);
  const currentVolume = useRef(0.25);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolumeState] = useState(0.25);
  const [playbackError, setPlaybackError] = useState("");
  const [clickSoundsEnabled, setClickSoundsEnabled] = useState(true);
  const [clickSoundError, setClickSoundError] = useState("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  desiredPlaying.current = isPlaying;
  clickSoundsEnabledRef.current = clickSoundsEnabled;
  currentVolume.current = volume;

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = currentVolume.current;
    try {
      await audio.play();
      setPlaybackError("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError" && !desiredPlaying.current) {
        return;
      }
      desiredPlaying.current = false;
      setIsPlaying(false);
      setPlaybackError(
        error instanceof Error
          ? `Music could not start: ${error.message}`
          : "Music could not start in this browser.",
      );
    }
  }, []);

  const playButtonBeep = useCallback(async () => {
    if (!clickSoundsEnabledRef.current) return;

    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) {
        setClickSoundError("Retro button sounds are not supported in this browser.");
        return;
      }

      const context =
        audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = context;
      if (context.state === "suspended") {
        await context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startTime = context.currentTime;
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.045, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.075);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener(
        "ended",
        () => {
          oscillator.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.08);
      setClickSoundError("");
    } catch (error) {
      setClickSoundError(
        error instanceof Error
          ? `Retro button sound failed: ${error.message}`
          : "Retro button sound could not be played in this browser.",
      );
    }
  }, []);

  useEffect(() => {
    try {
      const savedPlaying = window.localStorage.getItem(PLAYING_STORAGE_KEY);
      const savedVolumeText = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      const savedVolume = Number(savedVolumeText);
      const savedClickSounds = window.localStorage.getItem(CLICK_SOUNDS_STORAGE_KEY);
      if (savedPlaying === "true" || savedPlaying === "false") {
        setIsPlaying(savedPlaying === "true");
      }
      if (savedVolumeText !== null && Number.isFinite(savedVolume)) {
        setVolumeState(clampVolume(savedVolume));
      }
      if (savedClickSounds === "true" || savedClickSounds === "false") {
        setClickSoundsEnabled(savedClickSounds === "true");
      }
    } catch {
      setPlaybackError("Music preferences could not be read from this browser.");
      setClickSoundError("Button sound preferences could not be read from this browser.");
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;

    const handleButtonClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (
        !(button instanceof HTMLButtonElement) ||
        button.matches(":disabled") ||
        button.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }
      void playButtonBeep();
    };

    document.addEventListener("click", handleButtonClick, true);
    return () => document.removeEventListener("click", handleButtonClick, true);
  }, [playButtonBeep, preferencesLoaded]);

  useEffect(() => {
    const resumeAfterInteraction = (event: Event) => {
      hasInteracted.current = true;
      window.removeEventListener("pointerdown", resumeAfterInteraction, true);
      window.removeEventListener("keydown", resumeAfterInteraction, true);
      if (event.target instanceof Element && event.target.closest("[data-music-toggle]")) return;
      if (desiredPlaying.current) void playAudio();
    };
    window.addEventListener("pointerdown", resumeAfterInteraction, { capture: true });
    window.addEventListener("keydown", resumeAfterInteraction, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", resumeAfterInteraction, true);
      window.removeEventListener("keydown", resumeAfterInteraction, true);
    };
  }, [playAudio]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      window.localStorage.setItem(PLAYING_STORAGE_KEY, String(isPlaying));
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
      window.localStorage.setItem(CLICK_SOUNDS_STORAGE_KEY, String(clickSoundsEnabled));
    } catch {
      setPlaybackError("Audio preferences could not be saved in this browser.");
    }

    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    if (!isPlaying) {
      audio.pause();
    } else if (hasInteracted.current && audio.paused) {
      void playAudio();
    }
  }, [clickSoundsEnabled, isPlaying, playAudio, preferencesLoaded, volume]);

  const toggleMusic = useCallback(() => {
    hasInteracted.current = true;
    const shouldPlay = !desiredPlaying.current;
    desiredPlaying.current = shouldPlay;
    setIsPlaying(shouldPlay);
    if (shouldPlay) {
      void playAudio();
    } else {
      audioRef.current?.pause();
    }
  }, [playAudio]);

  const setVolume = useCallback((nextVolume: number) => {
    setVolumeState(clampVolume(nextVolume));
  }, []);

  const toggleClickSounds = useCallback(() => {
    setClickSoundError("");
    setClickSoundsEnabled((enabled) => !enabled);
  }, []);

  return (
    <BackgroundAudioContext.Provider
      value={{
        isPlaying,
        volume,
        playbackError,
        clickSoundsEnabled,
        clickSoundError,
        toggleMusic,
        toggleClickSounds,
        setVolume,
      }}
    >
      <audio
        ref={audioRef}
        src="/aventuras-en-hyrule.mp3"
        loop
        preload="none"
        onError={() => {
          desiredPlaying.current = false;
          setIsPlaying(false);
          setPlaybackError("The background music file could not be loaded.");
        }}
      />
      {children}
    </BackgroundAudioContext.Provider>
  );
}

export function useBackgroundAudio(): BackgroundAudioContextValue {
  const context = useContext(BackgroundAudioContext);
  if (!context) {
    throw new Error("useBackgroundAudio must be used within BackgroundAudioProvider.");
  }
  return context;
}
