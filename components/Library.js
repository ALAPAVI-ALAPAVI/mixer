'use client';

import { useState } from 'react';
import TrackRow from '@/components/TrackRow';
import FolderPickerModal from '@/components/FolderPickerModal';
import LocalSongsPanel from '@/components/LocalSongsPanel';

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

      {tab === 'cloud' &&
        (loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading your library…</p>
        ) : tracks.length === 0 ? (
          <div className="empty-state">
            Nothing here yet. Upload a song from the Home screen to get started — it'll sync
            to every device you sign into, and land in your default folder automatically.
          </div>
        ) : (
          <>
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
                    onPlay={() => (isCurrent ? onTogglePlayPause() : onPlay(index))}
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
            {tracks.length > 1 && (
              <button className="fab" onClick={onShufflePlay} aria-label="Shuffle play">
                🔀
              </button>
            )}
          </>
        ))}

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

      {folderPickerTrackId && (
        <FolderPickerModal
          trackId={folderPickerTrackId}
          onAddToFolder={onAddToFolder}
          onClose={() => setFolderPickerTrackId(null)}
        />
      )}
    </div>
  );
}
