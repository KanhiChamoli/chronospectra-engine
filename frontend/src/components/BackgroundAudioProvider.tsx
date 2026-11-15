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
  toggleMusic: () => void;
  setVolume: (volume: number) => void;
}

const BackgroundAudioContext = createContext<BackgroundAudioContextValue | null>(null);
const PLAYING_STORAGE_KEY = "chronospectra-music-playing";
const VOLUME_STORAGE_KEY = "chronospectra-music-volume";

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function BackgroundAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasInteracted = useRef(false);
  const desiredPlaying = useRef(true);
  const currentVolume = useRef(0.25);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolumeState] = useState(0.25);
  const [playbackError, setPlaybackError] = useState("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  desiredPlaying.current = isPlaying;
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

  useEffect(() => {
    try {
      const savedPlaying = window.localStorage.getItem(PLAYING_STORAGE_KEY);
      const savedVolumeText = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      const savedVolume = Number(savedVolumeText);
      if (savedPlaying === "true" || savedPlaying === "false") {
        setIsPlaying(savedPlaying === "true");
      }
      if (savedVolumeText !== null && Number.isFinite(savedVolume)) {
        setVolumeState(clampVolume(savedVolume));
      }
    } catch {
      setPlaybackError("Music preferences could not be read from this browser.");
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

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
    } catch {
      setPlaybackError("Music preferences could not be saved in this browser.");
    }

    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    if (!isPlaying) {
      audio.pause();
    } else if (hasInteracted.current && audio.paused) {
      void playAudio();
    }
  }, [isPlaying, playAudio, preferencesLoaded, volume]);

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

  return (
    <BackgroundAudioContext.Provider
      value={{ isPlaying, volume, playbackError, toggleMusic, setVolume }}
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
