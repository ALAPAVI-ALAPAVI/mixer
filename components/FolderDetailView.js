'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import TrackRow from '@/components/TrackRow';
import FolderPickerModal from '@/components/FolderPickerModal';
import { ShuffleIcon } from '@/components/icons';

export default function FolderDetailView({
  folder,
  allTracks,
  currentTrackId,
  isPlaying,
  offlineIds,
  onPlayQueue,
  onShufflePlay,
  onTogglePlayPause,
  onDownloadToggle,
  onAddToFolder,
  onBack,
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [busyTrackId, setBusyTrackId] = useState(null);
  const [folderPickerTrackId, setFolderPickerTrackId] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkFolderPicker, setBulkFolderPicker] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);

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

  async function handleDownloadToggle(track, isOffline) {
    setBusyTrackId(track.id);
    try {
      await onDownloadToggle(track, isOffline);
    } catch {
      setError('Could not update the offline copy of that track.');
    } finally {
      setBusyTrackId(null);
    }
  }

  function toggleSelectionMode() {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelected(trackId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  async function handleBulkRemove() {
    setBulkRemoving(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/folders/${folder.id}/tracks/${id}`, { method: 'DELETE' });
      }
      setTracks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {
      setError('Could not remove some of the selected songs.');
    } finally {
      setBulkRemoving(false);
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
        <button className="btn btn-ghost" onClick={() => setShowAddModal(true)}>
          + Add song
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {tracks.length > 0 && (
        <div className="select-toggle-row">
          <button className="btn-link" onClick={toggleSelectionMode}>
            {selectionMode ? 'Cancel' : 'Select'}
          </button>
        </div>
      )}

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
              <TrackRow
                key={track.id}
                track={track}
                isCurrent={isCurrent}
                isPlaying={isPlaying}
                selectable={selectionMode}
                selected={selectedIds.has(track.id)}
                onToggleSelect={() => toggleSelected(track.id)}
                onPlay={() => (isCurrent ? onTogglePlayPause() : onPlayQueue(tracks, index))}
                badge={isOffline ? <span className="offline-badge">Downloaded</span> : null}
                menuActions={[
                  {
                    label: isOffline ? 'Remove download' : busy ? 'Saving…' : 'Download',
                    onClick: () => handleDownloadToggle(track, isOffline),
                  },
                  { label: 'Add to another folder', onClick: () => setFolderPickerTrackId(track.id) },
                  { label: 'Remove from this folder', danger: true, onClick: () => handleRemoveTrack(track) },
                ]}
              />
            );
          })}
        </div>
      )}

      {!selectionMode && tracks.length > 0 && (
        <button className="fab" onClick={() => onShufflePlay(tracks)} aria-label="Shuffle play">
          <ShuffleIcon />
        </button>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} selected</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => setBulkFolderPicker(true)}>
              Add to folder
            </button>
            <button className="btn btn-danger" disabled={bulkRemoving} onClick={handleBulkRemove}>
              {bulkRemoving ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      )}

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

      {folderPickerTrackId && (
        <FolderPickerModal
          trackId={folderPickerTrackId}
          onAddToFolder={onAddToFolder}
          onClose={() => setFolderPickerTrackId(null)}
        />
      )}

      {bulkFolderPicker && (
        <FolderPickerModal
          trackIds={[...selectedIds]}
          onAddToFolder={onAddToFolder}
          onClose={() => {
            setBulkFolderPicker(false);
            setSelectionMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </section>
  );
}
