'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import Library from '@/components/Library';
import PlayerBar from '@/components/PlayerBar';
import RegisterSW from '@/components/RegisterSW';
import { getOfflineTrackBlob, listOfflineTrackIds, removeOfflineTrack } from '@/lib/offline';

export default function AppShell({ userName }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [offlineIds, setOfflineIds] = useState(new Set());

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState('');

  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  // Set up the audio element once on mount (browser-only).
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => playNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTracks();
    refreshOfflineIds();
  }, []);

  async function fetchTracks() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/tracks');
      if (!res.ok) throw new Error('Failed to load your library.');
      const data = await res.json();
      setTracks(data.tracks);
    } catch (err) {
      setLoadError('Could not load your library. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshOfflineIds() {
    try {
      const ids = await listOfflineTrackIds();
      setOfflineIds(new Set(ids));
    } catch {
      // IndexedDB unavailable (e.g. private browsing) - offline downloads just won't be offered.
    }
  }

  const playTrackAtIndex = useCallback(
    async (index) => {
      const track = tracks[index];
      const audio = audioRef.current;
      if (!track || !audio) return;

      setPlaybackError('');
      setCurrentIndex(index);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      try {
        const offlineBlob = await getOfflineTrackBlob(track.id);
        if (offlineBlob) {
          const url = URL.createObjectURL(offlineBlob);
          objectUrlRef.current = url;
          audio.src = url;
        } else {
          audio.src = track.blob_url;
        }
        await audio.play();
      } catch (err) {
        setPlaybackError('Could not play this track. It may need an internet connection.');
      }
    },
    [tracks]
  );

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentIndex === -1 && tracks.length > 0) {
      playTrackAtIndex(0);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => setPlaybackError('Could not resume playback.'));
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (tracks.length === 0) return;
    const next = currentIndex + 1 < tracks.length ? currentIndex + 1 : 0;
    playTrackAtIndex(next);
  }

  function playPrev() {
    if (tracks.length === 0) return;
    const prev = currentIndex - 1 >= 0 ? currentIndex - 1 : tracks.length - 1;
    playTrackAtIndex(prev);
  }

  function seekTo(seconds) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  }

  async function handleUploadDone() {
    // The new row is created by a server-side callback, not returned directly
    // to the browser, so refresh from the source of truth instead of guessing.
    await fetchTracks();
  }

  async function handleDelete(track) {
    const wasCurrent = tracks[currentIndex]?.id === track.id;
    try {
      const res = await fetch(`/api/tracks/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setTracks((prev) => prev.filter((t) => t.id !== track.id));
      await removeOfflineTrack(track.id);
      refreshOfflineIds();
      if (wasCurrent) {
        audioRef.current?.pause();
        setCurrentIndex(-1);
      }
    } catch {
      setLoadError('Could not delete that track. Try again.');
    }
  }

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  return (
    <div className="app-shell">
      <RegisterSW />
      <header className="top-bar">
        <span className="brand">Mixer</span>
        <div className="user-info">
          <span>{userName}</span>
          <button className="btn-link" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {loadError && <div className="form-error">{loadError}</div>}
        {playbackError && <div className="form-error">{playbackError}</div>}

        <Library
          tracks={tracks}
          loading={loading}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          offlineIds={offlineIds}
          onPlay={(index) => playTrackAtIndex(index)}
          onTogglePlayPause={togglePlayPause}
          onUploadDone={handleUploadDone}
          onDelete={handleDelete}
          onOfflineChange={refreshOfflineIds}
        />
      </main>

      <PlayerBar
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlayPause={togglePlayPause}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={seekTo}
      />
    </div>
  );
}
