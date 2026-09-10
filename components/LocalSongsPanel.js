'use client';

export default function LocalSongsPanel({ pendingUploads, syncing, syncProgress, isOnline, onSync, onCancel }) {
  return (
    <section>
      <div className="library-header">
        <h2>Local (not yet uploaded)</h2>
      </div>

      {pendingUploads.length === 0 ? (
        <div className="empty-state">Nothing queued — everything's synced to the cloud.</div>
      ) : (
        <>
          <div className="track-list">
            {pendingUploads.map((item) => (
              <div key={item.hash} className="track-row">
                <div className="track-meta">
                  <div className="title">{item.title}</div>
                  {item.artist && <div className="artist">{item.artist}</div>}
                </div>
                <span className="pending-badge">Not synced</span>
                <div className="track-actions">
                  <button className="btn btn-danger" disabled={syncing} onClick={() => onCancel(item.hash)}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="sync-row">
            <button className="btn btn-primary" disabled={!isOnline || syncing} onClick={onSync}>
              {syncing
                ? `Uploading… (${syncProgress.done}/${syncProgress.total})`
                : isOnline
                  ? 'Upload to Cloud'
                  : 'Upload to Cloud (offline)'}
            </button>
            {syncing && (
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${(syncProgress.done / Math.max(syncProgress.total, 1)) * 100}%` }}
                />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
