'use client';

import { useRef, useState } from 'react';
import { saveTrackOffline, removeOfflineTrack } from '@/lib/offline';
import { hashFile } from '@/lib/hash';
import { uploadTrackFile } from '@/lib/uploadTrack';
import LocalSongsPanel from '@/components/LocalSongsPanel';

export default function Library({
  tracks,
  loading,
  currentTrackId,
  isPlaying,
  offlineIds,
  onPlay,
  onTogglePlayPause,
  onUploadDone,
  onDelete,
  onOfflineChange,
  pendingUploads,
  onPlayPending,
  syncing,
  syncProgress,
  isOnline,
  onQueueOffline,
  onSync,
  onCancelPending,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [busyTrackId, setBusyTrackId] = useState(null);

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);

    try {
      const hash = await hashFile(file);

      // Dedup check against what we already know locally — catches the
      // common case instantly, without needing the network.
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
        // Uploads straight from the browser to Blob storage, bypassing the
        // ~4.5MB request size limit that Vercel's serverless functions have.
        await uploadTrackFile(file, { hash, title });

        // The database row is created by a server-to-server callback that
        // fires right after the upload lands, so it can trail by a moment.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await onUploadDone();
      } catch (err) {
        if (err.message && err.message.includes('DUPLICATE_TRACK')) {
          setUploadError('This song already exists in your library.');
        } else {
          // Couldn't reach the server — most likely offline. Queue it locally
          // instead of just failing, so the upload isn't lost.
          await onQueueOffline(file, { hash, title });
        }
      }
    } catch (err) {
      setUploadError(err.message || 'Could not process that file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(track) {
    setBusyTrackId(track.id);
    try {
      await saveTrackOffline(track);
      onOfflineChange();
    } catch (err) {
      setUploadError('Could not save that track for offline use.');
    } finally {
      setBusyTrackId(null);
    }
  }

  async function handleRemoveDownload(track) {
    setBusyTrackId(track.id);
    try {
      await removeOfflineTrack(track.id);
      onOfflineChange();
    } finally {
      setBusyTrackId(null);
    }
  }

  return (
    <div>
      <div className="library-header">
        <h2>All Songs</h2>
      </div>

      <LocalSongsPanel
        pendingUploads={pendingUploads}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        syncing={syncing}
        syncProgress={syncProgress}
        isOnline={isOnline}
        onPlay={onPlayPending}
        onSync={onSync}
        onCancel={onCancelPending}
      />

      <section style={{ marginTop: '28px' }}>
        <div className="library-header">
          <h2>Cloud</h2>
        </div>

        <div className="upload-row">
          <button
            className="btn btn-primary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Processing…' : 'Upload a song'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={handleFileChosen}
          />
        </div>

        {uploadError && <div className="form-error">{uploadError}</div>}

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading your library…</p>
        ) : tracks.length === 0 ? (
          <div className="empty-state">
            Nothing here yet. Upload a song from your device to get started — it'll sync to
            every device you sign into, and land in your default folder automatically.
          </div>
        ) : (
          <div className="track-list">
            {tracks.map((track, index) => {
              const isCurrent = track.id === currentTrackId;
              const isOffline = offlineIds.has(track.id);
              const busy = busyTrackId === track.id;

              return (
                <div key={track.id} className={`track-row${isCurrent ? ' active' : ''}`}>
                  <button
                    className="btn-icon"
                    onClick={() => (isCurrent ? onTogglePlayPause() : onPlay(index))}
                    aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrent && isPlaying ? '❚❚' : '▶'}
                  </button>

                  <div className="track-meta">
                    <div className="title">{track.title}</div>
                    {track.artist && <div className="artist">{track.artist}</div>}
                  </div>

                  {isOffline && <span className="offline-badge">Downloaded</span>}

                  <div className="track-actions">
                    {isOffline ? (
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => handleRemoveDownload(track)}
                      >
                        Remove download
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => handleDownload(track)}
                      >
                        {busy ? 'Saving…' : 'Download'}
                      </button>
                    )}
                    <button className="btn btn-danger" onClick={() => onDelete(track)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
