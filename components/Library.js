'use client';

import { useState } from 'react';
import TrackRow from '@/components/TrackRow';
import FolderPickerModal from '@/components/FolderPickerModal';
import LocalSongsPanel from '@/components/LocalSongsPanel';
import { ShuffleIcon, SearchIcon } from '@/components/icons';

export default function Library({
  tracks,
  loading,
  currentTrackId,
  isPlaying,
  offlineIds,
  onPlay,
  onShufflePlay,
  onTogglePlayPause,
  onDelete,
  onBulkDelete,
  onDownloadToggle,
  onAddToFolder,
  pendingUploads,
  onPlayPending,
  onShufflePending,
  syncing,
  syncProgress,
  isOnline,
  onSync,
  onSyncOne,
  onCancelPending,
}) {
  const [tab, setTab] = useState('cloud'); // 'cloud' | 'local'
  const [error, setError] = useState('');
  const [busyTrackId, setBusyTrackId] = useState(null);
  const [folderPickerTrackId, setFolderPickerTrackId] = useState(null);
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkFolderPicker, setBulkFolderPicker] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const query = search.trim().toLowerCase();
  const filteredTracks = query
    ? tracks.filter(
        (t) => t.title.toLowerCase().includes(query) || (t.artist || '').toLowerCase().includes(query)
      )
    : tracks;

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

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await onBulkDelete([...selectedIds]);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {
      setError('Could not delete some of the selected songs.');
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div>
      <div className="library-header">
        <h2>All Songs</h2>
      </div>

      <div className="segmented-nav">
        <button className={`segmented-item${tab === 'cloud' ? ' active' : ''}`} onClick={() => setTab('cloud')}>
          Cloud
        </button>
        <button className={`segmented-item${tab === 'local' ? ' active' : ''}`} onClick={() => setTab('local')}>
          Local{pendingUploads.length > 0 ? ` (${pendingUploads.length})` : ''}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {tab === 'cloud' && (
        <>
          <div className="search-row">
            <SearchIcon width={16} height={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search songs or artists"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {tracks.length > 0 && (
            <div className="select-toggle-row">
              <button className="btn-link" onClick={toggleSelectionMode}>
                {selectionMode ? 'Cancel' : 'Select'}
              </button>
            </div>
          )}

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading your library…</p>
          ) : tracks.length === 0 ? (
            <div className="empty-state">
              Nothing here yet. Upload a song from the Home screen to get started — it'll sync
              to every device you sign into, and land in your default folder automatically.
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="empty-state">No songs match "{search}".</div>
          ) : (
            <>
              <div className="track-list">
                {filteredTracks.map((track) => {
                  const originalIndex = tracks.indexOf(track);
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
                      onPlay={() => (isCurrent ? onTogglePlayPause() : onPlay(originalIndex))}
                      badge={isOffline ? <span className="offline-badge">Downloaded</span> : null}
                      menuActions={[
                        {
                          label: isOffline ? 'Remove download' : busy ? 'Saving…' : 'Download',
                          onClick: () => handleDownloadToggle(track, isOffline),
                        },
                        { label: 'Add to folder', onClick: () => setFolderPickerTrackId(track.id) },
                        { label: 'Delete', danger: true, onClick: () => onDelete(track) },
                      ]}
                    />
                  );
                })}
              </div>
              {!selectionMode && tracks.length > 1 && (
                <button className="fab" onClick={onShufflePlay} aria-label="Shuffle play">
                  <ShuffleIcon />
                </button>
              )}
            </>
          )}
        </>
      )}

      {tab === 'local' && (
        <LocalSongsPanel
          pendingUploads={pendingUploads}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          syncing={syncing}
          syncProgress={syncProgress}
          isOnline={isOnline}
          onPlay={onPlayPending}
          onShufflePlay={onShufflePending}
          onSync={onSync}
          onSyncOne={onSyncOne}
          onCancel={onCancelPending}
        />
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} selected</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => setBulkFolderPicker(true)}>
              Add to folder
            </button>
            <button className="btn btn-danger" disabled={bulkDeleting} onClick={handleBulkDelete}>
              {bulkDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
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
    </div>
  );
}
