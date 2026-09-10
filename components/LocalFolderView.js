'use client';

import LocalSongsPanel from '@/components/LocalSongsPanel';

export default function LocalFolderView({ pendingUploads, syncing, syncProgress, isOnline, onSync, onCancel, onBack }) {
  return (
    <div>
      <div className="library-header">
        <button className="btn-link back-link" onClick={onBack}>
          ← Folders
        </button>
      </div>
      <LocalSongsPanel
        pendingUploads={pendingUploads}
        syncing={syncing}
        syncProgress={syncProgress}
        isOnline={isOnline}
        onSync={onSync}
        onCancel={onCancel}
      />
    </div>
  );
}
