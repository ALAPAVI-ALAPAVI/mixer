'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Library from '@/components/Library';
import PlayerBar from '@/components/PlayerBar';
import RegisterSW from '@/components/RegisterSW';
import BottomNav from '@/components/BottomNav';
import HomeScreen from '@/components/HomeScreen';
import FoldersScreen from '@/components/FoldersScreen';
import FolderDetailView from '@/components/FolderDetailView';
import LocalFolderView from '@/components/LocalFolderView';
import AccountScreen from '@/components/AccountScreen';
import NowPlayingScreen from '@/components/NowPlayingScreen';
import {
  getOfflineTrackBlob,
  listOfflineTrackIds,
  removeOfflineTrack,
  cacheTracksMeta,
  getCachedTracksMeta,
  queuePendingUpload,
  listPendingUploads,
  removePendingUpload,
} from '@/lib/offline';
import { uploadTrackFile, DUPLICATE_TRACK_ERROR } from '@/lib/uploadTrack';

// Turns a raw pending-upload record (keyed by hash, holding a Blob) into
// something that looks like a normal track for playback/UI purposes.
function toPlayable(pending) {
  return {
    id: `pending:${pending.hash}`,
    title: pending.title,
    artist: pending.artist,
    blob: pending.blob,
    isPending: true,
    hash: pending.hash,
  };
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function AppShell({ userName }) {
  const [section, setSection] = useState('home'); // 'home' | 'folders' | 'allsongs' | 'account'
  const [selectedFolder, setSelectedFolder] = useState(null);

  const [tracks, setTracks] = useState([]); // the full "All Songs" / Cloud library
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [usingCachedLibrary, setUsingCachedLibrary] = useState(false);
  const [offlineIds, setOfflineIds] = useState(new Set());

  const [pendingUploads, setPendingUploads] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const [isOnline, setIsOnline] = useState(true);

  // Playback works off a "queue" — whichever list of tracks the person is
  // currently playing from (All Songs, a folder, or the local pending list) —
  // rather than always assuming the global library.
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  // Set up the audio element once on mount (browser-only).
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => advanceOnEnd();
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

  // Track real connectivity so the "Upload to Cloud" button only enables when
  // there's actually a network to use.
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    fetchTracks();
    refreshOfflineIds();
    refreshPendingUploads();
  }, []);

  async function fetchTracks() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/tracks');
      if (!res.ok) throw new Error('Failed to load your library.');
      const data = await res.json();
      setTracks(data.tracks);
      setUsingCachedLibrary(false);
      cacheTracksMeta(data.tracks).catch(() => {});
    } catch {
      // Likely offline — fall back to whatever we last successfully loaded,
      // so the library isn't just empty after a reload with no connection.
      try {
        const cached = await getCachedTracksMeta();
        if (cached && cached.length > 0) {
          setTracks(cached);
          setUsingCachedLibrary(true);
          setLoadError('');
        } else {
          setLoadError('Could not load your library. Check your connection and try again.');
        }
      } catch {
        setLoadError('Could not load your library. Check your connection and try again.');
      }
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

  async function refreshPendingUploads() {
    try {
      const list = await listPendingUploads();
      setPendingUploads(list);
    } catch {
      // IndexedDB unavailable - offline upload queueing just won't be offered.
    }
  }

  // Plays a track from a given list (All Songs, a folder, or the pending
  // local queue) starting at `index`, and remembers that list as the queue
  // so next/prev/shuffle/loop keep working within it. Tracks that carry a
  // `.blob` directly (pending uploads not yet synced) play straight from
  // that Blob; everything else falls back to an offline-downloaded copy if
  // one exists, or streams from the cloud URL.
  const playFromQueue = useCallback(async (list, index) => {
    const track = list[index];
    const audio = audioRef.current;
    if (!track || !audio) return;

    setPlaybackError('');
    setQueue(list);
    setQueueIndex(index);
    setShowNowPlaying(true);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    try {
      if (track.blob) {
        // A song that only exists locally so far (queued offline, not yet uploaded).
        const url = URL.createObjectURL(track.blob);
        objectUrlRef.current = url;
        audio.src = url;
      } else {
        const offlineBlob = await getOfflineTrackBlob(track.id);
        if (offlineBlob) {
          const url = URL.createObjectURL(offlineBlob);
          objectUrlRef.current = url;
          audio.src = url;
        } else {
          audio.src = track.blob_url;
        }
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

  // Manual "next"/"previous" always wraps around the queue — that's the
  // useful behavior when someone is actively skipping through songs.
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

  // What happens when a song finishes on its own: by default, play through
  // the list in order and stop after the last track. With Loop on, wrap
  // back around to the start and keep going.
  function advanceOnEnd() {
    if (queue.length === 0) return;
    const atEnd = queueIndex + 1 >= queue.length;
    if (atEnd && !loop) {
      audioRef.current?.pause();
      return;
    }
    const next = atEnd ? 0 : queueIndex + 1;
    playFromQueue(queue, next);
  }

  function toggleShuffle() {
    setShuffle((prev) => {
      const turningOn = !prev;
      if (turningOn && queue.length > 0) {
        // Shuffle only the upcoming songs — leave what's already playing in place.
        const head = queue.slice(0, queueIndex + 1);
        const tail = shuffleArray(queue.slice(queueIndex + 1));
        setQueue([...head, ...tail]);
      }
      return turningOn;
    });
  }

  function toggleLoop() {
    setLoop((prev) => !prev);
  }

  // Shuffles an entire list and starts playing it from the top — used by the
  // Shuffle button inside a folder.
  function shufflePlay(list) {
    if (list.length === 0) return;
    const shuffled = shuffleArray(list);
    setShuffle(true);
    playFromQueue(shuffled, 0);
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

  async function handleQueueOffline(file, { hash, title, artist }) {
    await queuePendingUpload({ hash, blob: file, title, artist, fileName: file.name, fileType: file.type });
    await refreshPendingUploads();
  }

  async function handleCancelPending(hash) {
    if (queue[queueIndex]?.hash === hash) {
      audioRef.current?.pause();
      setQueueIndex(-1);
      setShowNowPlaying(false);
    }
    await removePendingUpload(hash);
    await refreshPendingUploads();
  }

  async function handleSyncPendingUploads() {
    const list = await listPendingUploads();
    if (list.length === 0) return;

    setSyncing(true);
    setSyncProgress({ done: 0, total: list.length });

    let done = 0;
    for (const item of list) {
      try {
        const file = new File([item.blob], item.fileName, { type: item.fileType });
        await uploadTrackFile(file, { hash: item.hash, title: item.title, artist: item.artist });
        await removePendingUpload(item.hash);
        done += 1;
        setSyncProgress({ done, total: list.length });
      } catch (err) {
        if (err.message && err.message.includes(DUPLICATE_TRACK_ERROR)) {
          // Already uploaded from elsewhere in the meantime — safe to drop from the queue.
          await removePendingUpload(item.hash);
          done += 1;
          setSyncProgress({ done, total: list.length });
          continue;
        }
        // Probably lost connection again — stop here, leave the rest queued for next time.
        break;
      }
    }

    await refreshPendingUploads();
    await fetchTracks();
    setSyncing(false);
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
        setShowNowPlaying(false);
      }
    } catch {
      setLoadError('Could not delete that track. Try again.');
    }
  }

  async function handleAddToFolder(trackId, folderId) {
    const res = await fetch(`/api/folders/${folderId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId }),
    });
    if (!res.ok) throw new Error('Could not add song to folder.');
  }

  function navigate(nextSection) {
    setSection(nextSection);
    setSelectedFolder(null);
  }

  const currentTrack = queueIndex >= 0 ? queue[queueIndex] : null;
  const pendingPlayable = pendingUploads.map(toPlayable);

  return (
    <div className="app-shell">
      <RegisterSW />
      <header className="top-bar">
        <span className="brand">Mixer</span>
      </header>

      <main className="content">
        {loadError && <div className="form-error">{loadError}</div>}
        {usingCachedLibrary && (
          <div className="form-error" style={{ background: 'rgba(232,163,61,0.12)', borderColor: 'rgba(232,163,61,0.4)', color: 'var(--accent)' }}>
            You're offline — showing your last-known library.
          </div>
        )}
        {playbackError && <div className="form-error">{playbackError}</div>}

        {section === 'home' && <HomeScreen userName={userName} onNavigate={navigate} />}

        {section === 'folders' && !selectedFolder && (
          <FoldersScreen onOpenFolder={setSelectedFolder} pendingCount={pendingUploads.length} />
        )}

        {section === 'folders' && selectedFolder && selectedFolder.virtual && (
          <LocalFolderView
            pendingUploads={pendingUploads}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            syncing={syncing}
            syncProgress={syncProgress}
            isOnline={isOnline}
            onPlay={(index) => playFromQueue(pendingPlayable, index)}
            onSync={handleSyncPendingUploads}
            onCancel={handleCancelPending}
            onBack={() => setSelectedFolder(null)}
          />
        )}

        {section === 'folders' && selectedFolder && !selectedFolder.virtual && (
          <FolderDetailView
            folder={selectedFolder}
            allTracks={tracks}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            offlineIds={offlineIds}
            onPlayQueue={playFromQueue}
            onShufflePlay={shufflePlay}
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
            pendingUploads={pendingUploads}
            onPlayPending={(index) => playFromQueue(pendingPlayable, index)}
            syncing={syncing}
            syncProgress={syncProgress}
            isOnline={isOnline}
            onQueueOffline={handleQueueOffline}
            onSync={handleSyncPendingUploads}
            onCancelPending={handleCancelPending}
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
        onExpand={() => currentTrack && setShowNowPlaying(true)}
      />

      {showNowPlaying && currentTrack && (
        <NowPlayingScreen
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          shuffle={shuffle}
          loop={loop}
          onClose={() => setShowNowPlaying(false)}
          onTogglePlayPause={togglePlayPause}
          onNext={playNext}
          onPrev={playPrev}
          onSeek={seekTo}
          onToggleShuffle={toggleShuffle}
          onToggleLoop={toggleLoop}
          onDelete={handleDelete}
          onRemovePending={handleCancelPending}
          onAddToFolder={handleAddToFolder}
        />
      )}

      <BottomNav active={section} onNavigate={navigate} />
    </div>
  );
}
