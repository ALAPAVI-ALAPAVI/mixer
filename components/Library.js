'use client';

import { useRef, useState } from 'react';
import { saveTrackOffline, removeOfflineTrack } from '@/lib/offline';

export default function Library({
  tracks,
  loading,
  currentTrackId,
  isPlaying,
  offlineIds,
  onPlay,
  onTogglePlayPause,
  onUploaded,
  onDelete,
  onOfflineChange,
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

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    try {
      const res = await fetch('/api/tracks', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onUploaded(data.track);
    } catch (err) {
      setUploadError(err.message || 'Could not upload that file.');
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
    <section>
      <div className="library-header">
        <h2>Your library</h2>
      </div>

      <div className="upload-row">
        <button
          className="btn btn-primary"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Upload a song'}
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
          every device you sign into.
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
  );
}
