"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, ChevronLeft, ExternalLink, Info, LogOut, Menu, Pause, Play, Presentation, Trash, UserRoundX, Volume2 } from "lucide-react";
import { useBackgroundAudio } from "@/components/BackgroundAudioProvider";
import type { AuthUser, Observation } from "@/types/auth";

interface ObservationSidebarProps {
  user: AuthUser | null;
  observations: Observation[];
  open: boolean;
  loading: boolean;
  error: string;
  onToggle: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onOpenObservation: (observation: Observation) => void;
  onDeleteObservation: (id: number) => void;
  onUpdateNotes: (id: number, notes: string) => void;
}

export function ObservationSidebar({
  user,
  observations,
  open,
  loading,
  error,
  onToggle,
  onSignIn,
  onSignOut,
  onDeleteAccount,
  onOpenObservation,
  onDeleteObservation,
  onUpdateNotes,
}: ObservationSidebarProps) {
  const [notes, setNotes] = useState<Record<number, string>>({});
  const { isPlaying, volume, playbackError, toggleMusic, setVolume } = useBackgroundAudio();

  return (
    <aside className={`observatory-sidebar${open ? " expanded" : ""}`} aria-label="Observatory navigation">
      <button className="sidebar-toggle" type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Collapse navigation" : "Expand navigation"}>
        {open ? <ChevronLeft size={17} /> : <Menu size={17} />}
      </button>
      <div className="sidebar-content">
        <p className="sidebar-section-label">OBSERVATORY</p>
        <button type="button" className="sidebar-link active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span aria-hidden="true"><BookOpen size={15} /></span><span>Sky view</span>
        </button>
        <div className="sidebar-group-label"><span aria-hidden="true"><BookOpen size={15} /></span><span>My Observations</span><b>{observations.length}</b></div>
        {!user ? (
          <div className="sidebar-empty">
            <p>Sign in to keep a private, synchronized observing logbook.</p>
            <button type="button" className="secondary-action" onClick={onSignIn}>Sign in / Join</button>
          </div>
        ) : (
          <div className="observation-sidebar-list">
            <p className="signed-in-as">{user.full_name}</p>
            {loading && <p className="sidebar-muted">Loading observations…</p>}
            {error && <p className="error-message" role="alert">{error}</p>}
            {!loading && observations.length === 0 && <p className="sidebar-muted">Saved targets will appear here.</p>}
            {observations.map((observation) => (
              <article className="observation-entry" key={observation.id}>
                <button type="button" className="observation-target" onClick={() => onOpenObservation(observation)}>
                  <strong>{observation.target_name}</strong>
                  <span>{observation.ra_deg.toFixed(3)}°, {observation.dec_deg.toFixed(3)}°</span>
                </button>
                <textarea
                  aria-label={`Notes for ${observation.target_name}`}
                  maxLength={4000}
                  value={notes[observation.id] ?? observation.notes}
                  onChange={(event) => setNotes({ ...notes, [observation.id]: event.target.value })}
                  placeholder="Add observing notes…"
                  rows={2}
                />
                <div className="observation-entry-actions">
                  <button type="button" onClick={() => onUpdateNotes(observation.id, notes[observation.id] ?? observation.notes)}>Save notes</button>
                  <button type="button" className="delete-observation" onClick={() => onDeleteObservation(observation.id)} aria-label={`Remove ${observation.target_name}`}><Trash size={12} /> Remove</button>
                </div>
              </article>
            ))}
            <button className="sidebar-signout" type="button" onClick={onSignOut}><LogOut size={13} /> Sign out</button>
            <button
              className="sidebar-delete-account"
              type="button"
              onClick={() => {
                if (window.confirm("Permanently delete your account, sessions, and saved observations? This cannot be undone.")) {
                  onDeleteAccount();
                }
              }}
            >
              <UserRoundX size={13} /> Delete account
            </button>
          </div>
        )}
        <section className="sidebar-audio" aria-label="Background music controls">
          <button
            type="button"
            className="sidebar-link music-toggle"
            data-music-toggle
            onClick={toggleMusic}
            aria-pressed={isPlaying}
          >
            <span aria-hidden="true">{isPlaying ? <Pause size={15} /> : <Play size={15} />}</span>
            <span>{isPlaying ? "Music on" : "Music off"}</span>
          </button>
          <label className="music-volume">
            <span><Volume2 size={13} /> Volume <output>{Math.round(volume * 100)}%</output></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Background music volume"
            />
          </label>
          {playbackError && <p className="music-error" role="status">{playbackError}</p>}
        </section>
        <nav className="sidebar-footer" aria-label="About Chronospectra">
          <Link href="/pitch-deck"><span aria-hidden="true"><Presentation size={15} /></span><span>Pitch deck</span></Link>
          <Link href="/credits"><span aria-hidden="true"><Info size={15} /></span><span>Data credits</span></Link>
          <Link href="/privacy-terms"><span aria-hidden="true"><BookOpen size={15} /></span><span>Privacy &amp; terms</span></Link>
          <a href="https://github.com/kanhichamoli/chronospectra-engine" target="_blank" rel="noreferrer"><span aria-hidden="true"><ExternalLink size={15} /></span><span>About / source</span></a>
        </nav>
        <small className="sidebar-copyright">© Kanhi Chamoli</small>
      </div>
    </aside>
  );
}
