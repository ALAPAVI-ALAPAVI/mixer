'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';

export default function FolderDetailView({
  folder,
  allTracks,
  currentTrackId,
  isPlaying,
  offlineIds,
  onPlayQueue,
  onTogglePlayPause,
  onBack,
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [busyTrackId, setBusyTrackId] = useState(null);

  useEffect(() => {
    fetchFolderTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.id]);

  async function fetchFolderTracks() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/folders/${folder.id}`);
      if (!res.ok) throw new Error('Failed to load this folder.');
      const data = await res.json();
      setTracks(data.tracks);
    } catch {
      setError('Could not load this folder.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTrack(track) {
    setBusyTrackId(track.id);
    try {
      const res = await fetch(`/api/folders/${folder.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });
      if (!res.ok) throw new Error('Could not add that song.');
      setTracks((prev) => [track, ...prev]);
    } catch {
      setError('Could not add that song to the folder.');
    } finally {
      setBusyTrackId(null);
    }
  }

  async function handleRemoveTrack(track) {
    setBusyTrackId(track.id);
    try {
      const res = await fetch(`/api/folders/${folder.id}/tracks/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove that song.');
      setTracks((prev) => prev.filter((t) => t.id !== track.id));
    } catch {
      setError('Could not remove that song from the folder.');
    } finally {
      setBusyTrackId(null);
    }
  }

  const availableToAdd = allTracks.filter((t) => !tracks.some((ft) => ft.id === t.id));

  return (
    <section>
      <div className="library-header">
        <button className="btn-link back-link" onClick={onBack}>
          ← Folders
        </button>
      </div>
      <div className="library-header">
        <h2>{folder.name}</h2>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : tracks.length === 0 ? (
        <div className="empty-state">No songs in this folder yet. Add some from your library.</div>
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
                  onClick={() => (isCurrent ? onTogglePlayPause() : onPlayQueue(tracks, index))}
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
                  <button className="btn btn-danger" disabled={busy} onClick={() => handleRemoveTrack(track)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => setShowAddModal(true)} aria-label="Add song">
        +
      </button>

      {showAddModal && (
        <Modal title="Add a song" onClose={() => setShowAddModal(false)}>
          {availableToAdd.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              Every song in your library is already in this folder.
            </p>
          ) : (
            <div className="track-list">
              {availableToAdd.map((track) => (
                <div key={track.id} className="track-row">
                  <div className="track-meta">
                    <div className="title">{track.title}</div>
                    {track.artist && <div className="artist">{track.artist}</div>}
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={busyTrackId === track.id}
                    onClick={() => handleAddTrack(track)}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
