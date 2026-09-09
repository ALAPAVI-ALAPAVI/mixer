'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Library from '@/components/Library';
import PlayerBar from '@/components/PlayerBar';
import RegisterSW from '@/components/RegisterSW';
import BottomNav from '@/components/BottomNav';
import HomeScreen from '@/components/HomeScreen';
import FoldersScreen from '@/components/FoldersScreen';
import FolderDetailView from '@/components/FolderDetailView';
import AccountScreen from '@/components/AccountScreen';
import { getOfflineTrackBlob, listOfflineTrackIds, removeOfflineTrack } from '@/lib/offline';

export default function AppShell({ userName }) {
  const [section, setSection] = useState('home'); // 'home' | 'folders' | 'allsongs' | 'account'
  const [selectedFolder, setSelectedFolder] = useState(null);

  const [tracks, setTracks] = useState([]); // the full "All Songs" library
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [offlineIds, setOfflineIds] = useState(new Set());

  // Playback works off a "queue" — whichever list of tracks the person is
  // currently playing from (All Songs, or a specific folder) — rather than
  // always assuming the global library.
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
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
    } catch {
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

  // Plays a track from a given list (the All Songs library, or a folder's
  // track list) starting at `index`, and remembers that list as the queue so
  // next/prev keep working within whichever list you were playing from.
  const playFromQueue = useCallback(async (list, index) => {
    const track = list[index];
    const audio = audioRef.current;
    if (!track || !audio) return;

    setPlaybackError('');
    setQueue(list);
    setQueueIndex(index);

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
    } catch {
      setPlaybackError('Could not play this track. It may need an internet connection.');
    }
  }, []);

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (queueIndex === -1 && queue.length > 0) {
      playFromQueue(queue, 0);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => setPlaybackError('Could not resume playback.'));
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (queue.length === 0) return;
    const next = queueIndex + 1 < queue.length ? queueIndex + 1 : 0;
    playFromQueue(queue, next);
  }

  function playPrev() {
    if (queue.length === 0) return;
    const prev = queueIndex - 1 >= 0 ? queueIndex - 1 : queue.length - 1;
    playFromQueue(queue, prev);
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
    const wasCurrent = queue[queueIndex]?.id === track.id;
    try {
      const res = await fetch(`/api/tracks/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setTracks((prev) => prev.filter((t) => t.id !== track.id));
      await removeOfflineTrack(track.id);
      refreshOfflineIds();
      if (wasCurrent) {
        audioRef.current?.pause();
        setQueueIndex(-1);
      }
    } catch {
      setLoadError('Could not delete that track. Try again.');
    }
  }

  function navigate(nextSection) {
    setSection(nextSection);
    setSelectedFolder(null);
  }

  const currentTrack = queueIndex >= 0 ? queue[queueIndex] : null;

  return (
    <div className="app-shell">
      <RegisterSW />
      <header className="top-bar">
        <span className="brand">Mixer</span>
      </header>

      <main className="content">
        {loadError && <div className="form-error">{loadError}</div>}
        {playbackError && <div className="form-error">{playbackError}</div>}

        {section === 'home' && <HomeScreen userName={userName} onNavigate={navigate} />}

        {section === 'folders' && !selectedFolder && (
          <FoldersScreen onOpenFolder={setSelectedFolder} />
        )}

        {section === 'folders' && selectedFolder && (
          <FolderDetailView
            folder={selectedFolder}
            allTracks={tracks}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            offlineIds={offlineIds}
            onPlayQueue={playFromQueue}
            onTogglePlayPause={togglePlayPause}
            onBack={() => setSelectedFolder(null)}
          />
        )}

        {section === 'allsongs' && (
          <Library
            tracks={tracks}
            loading={loading}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            offlineIds={offlineIds}
            onPlay={(index) => playFromQueue(tracks, index)}
            onTogglePlayPause={togglePlayPause}
            onUploadDone={handleUploadDone}
            onDelete={handleDelete}
            onOfflineChange={refreshOfflineIds}
          />
        )}

        {section === 'account' && <AccountScreen userName={userName} />}
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

      <BottomNav active={section} onNavigate={navigate} />
    </div>
  );
}
