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
  saveTrackOffline,
  saveTrackOfflineFromBlob,
  cacheTracksMeta,
  getCachedTracksMeta,
  queuePendingUpload,
  listPendingUploads,
  removePendingUpload,
} from '@/lib/offline';
import { hashFile } from '@/lib/hash';
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');

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

  // Refs mirroring the latest queue/loop state, so the audio element's
  // long-lived "ended" listener (attached once on mount) always acts on
  // current values instead of the stale ones from its first render.
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const loopRef = useRef(loop);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  // Set up the audio element once on mount (browser-only).
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      const q = queueRef.current;
      const idx = queueIndexRef.current;
      if (q.length === 0) return;
      const atEnd = idx + 1 >= q.length;
      if (atEnd && !loopRef.current) {
        audio.pause();
        return;
      }
      const next = atEnd ? 0 : idx + 1;
      playFromQueueRef.current(q, next);
    };
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
      return data.tracks;
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
      return [];
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

  // The "ended" listener (attached once, see the ref dance above) needs a
  // stable way to call the latest playFromQueue.
  const playFromQueueRef = useRef(playFromQueue);
  useEffect(() => { playFromQueueRef.current = playFromQueue; }, [playFromQueue]);

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
  // Shuffle button inside a folder and the Local (offline) queue.
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

  // Centralized upload path — used by the Home screen's uploader. Handles
  // fingerprinting for duplicate detection, uploading straight to Blob
  // storage, falling back to the offline queue on failure, and — importantly
  // — automatically keeping a locally-playable copy on THIS device once the
  // upload succeeds, since the bytes are already sitting right here in memory
  // and there's no reason to make the uploading device re-download its own file.
  async function handleUploadFile(file) {
    setUploadError('');
    setUploadNotice('');
    setUploading(true);
    try {
      const hash = await hashFile(file);

      if (tracks.some((t) => t.content_hash === hash)) {
        setUploadError('This song already exists in your library.');
        return;
      }
      if (pendingUploads.some((p) => p.hash === hash)) {
        setUploadError('This song is already queued to upload.');
        return;
      }

      const title = file.name.replace(/\.[^/.]+$/, '');

      try {
        await uploadTrackFile(file, { hash, title });

        // The database row is created by a server-to-server callback that
        // fires right after the upload lands, so it can trail by a moment.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const freshTracks = await fetchTracks();
        const newTrack = freshTracks.find((t) => t.content_hash === hash);
        if (newTrack) {
          await saveTrackOfflineFromBlob(newTrack.id, file, { title: newTrack.title, artist: newTrack.artist });
          await refreshOfflineIds();
        }
        setUploadNotice(`"${title}" uploaded.`);
      } catch (err) {
        if (err.message && err.message.includes(DUPLICATE_TRACK_ERROR)) {
          setUploadError('This song already exists in your library.');
        } else {
          // Couldn't reach the server — most likely offline. Queue it locally
          // instead of just failing, so the upload isn't lost.
          await handleQueueOffline(file, { hash, title });
          setUploadNotice(`"${title}" saved locally — will upload once you're online.`);
        }
      }
    } catch (err) {
      setUploadError(err.message || 'Could not process that file.');
    } finally {
      setUploading(false);
    }
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

  // Uploads one queued item to the cloud and, on success, keeps a locally
  // playable copy on this device (no redundant re-download of a file this
  // device already has). Returns true on success, false if it should stay
  // queued (e.g. still offline).
  async function syncSingleItem(item) {
    try {
      const file = new File([item.blob], item.fileName, { type: item.fileType });
      await uploadTrackFile(file, { hash: item.hash, title: item.title, artist: item.artist });
      await removePendingUpload(item.hash);

      await new Promise((resolve) => setTimeout(resolve, 1200));
      const freshTracks = await fetchTracks();
      const matched = freshTracks.find((t) => t.content_hash === item.hash);
      if (matched) {
        await saveTrackOfflineFromBlob(matched.id, item.blob, { title: matched.title, artist: matched.artist });
        await refreshOfflineIds();
      }
      return true;
    } catch (err) {
      if (err.message && err.message.includes(DUPLICATE_TRACK_ERROR)) {
        // Already uploaded from elsewhere in the meantime — safe to drop from the queue.
        await removePendingUpload(item.hash);
        return true;
      }
      return false;
    }
  }

  async function handleSyncOne(hash) {
    const item = pendingUploads.find((p) => p.hash === hash);
    if (!item) return;
    await syncSingleItem(item);
    await refreshPendingUploads();
  }

  async function handleSyncPendingUploads() {
    const list = await listPendingUploads();
    if (list.length === 0) return;

    setSyncing(true);
    setSyncProgress({ done: 0, total: list.length });

    let done = 0;
    for (const item of list) {
      const ok = await syncSingleItem(item);
      if (!ok) break; // probably lost connection again — leave the rest queued for next time
      done += 1;
      setSyncProgress({ done, total: list.length });
    }

    await refreshPendingUploads();
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

  async function handleDownloadToggle(track, isOffline) {
    if (isOffline) {
      await removeOfflineTrack(track.id);
    } else {
      await saveTrackOffline(track);
    }
    await refreshOfflineIds();
  }

  async function handleRenameFolder(folderId, name) {
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Could not rename folder.');
  }

  async function handleDeleteFolder(folderId) {
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete folder.');
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

        {section === 'home' && (
          <HomeScreen
            userName={userName}
            onNavigate={navigate}
            uploading={uploading}
            uploadError={uploadError}
            uploadNotice={uploadNotice}
            onUpload={handleUploadFile}
          />
        )}

        {section === 'folders' && !selectedFolder && (
          <FoldersScreen
            onOpenFolder={setSelectedFolder}
            pendingCount={pendingUploads.length}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
          />
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
            onShufflePlay={() => shufflePlay(pendingPlayable)}
            onSync={handleSyncPendingUploads}
            onSyncOne={handleSyncOne}
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
            onDownloadToggle={handleDownloadToggle}
            onAddToFolder={handleAddToFolder}
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
            onShufflePlay={() => shufflePlay(tracks)}
            onTogglePlayPause={togglePlayPause}
            onDelete={handleDelete}
            onDownloadToggle={handleDownloadToggle}
            onAddToFolder={handleAddToFolder}
            pendingUploads={pendingUploads}
            onPlayPending={(index) => playFromQueue(pendingPlayable, index)}
            onShufflePending={() => shufflePlay(pendingPlayable)}
            syncing={syncing}
            syncProgress={syncProgress}
            isOnline={isOnline}
            onSync={handleSyncPendingUploads}
            onSyncOne={handleSyncOne}
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
