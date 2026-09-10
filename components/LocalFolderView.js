'use client';

import LocalSongsPanel from '@/components/LocalSongsPanel';

export default function LocalFolderView({
  pendingUploads,
  currentTrackId,
  isPlaying,
  syncing,
  syncProgress,
  isOnline,
  onPlay,
  onSync,
  onCancel,
  onBack,
}) {
  return (
    <div>
      <div className="library-header">
        <button className="btn-link back-link" onClick={onBack}>
          ← Folders
        </button>
      </div>
      <LocalSongsPanel
        pendingUploads={pendingUploads}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        syncing={syncing}
        syncProgress={syncProgress}
        isOnline={isOnline}
        onPlay={onPlay}
        onSync={onSync}
        onCancel={onCancel}
      />
    </div>
  );
}
