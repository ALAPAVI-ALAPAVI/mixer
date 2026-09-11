'use client';

import TrackRow from '@/components/TrackRow';

export default function LocalSongsPanel({
  pendingUploads,
  currentTrackId,
  isPlaying,
  syncing,
  syncProgress,
  isOnline,
  onPlay,
  onShufflePlay,
  onSync,
  onSyncOne,
  onCancel,
}) {
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
            {pendingUploads.map((item, index) => {
              const trackId = `pending:${item.hash}`;
              const isCurrent = trackId === currentTrackId;

              return (
                <TrackRow
                  key={item.hash}
                  track={item}
                  isCurrent={isCurrent}
                  isPlaying={isPlaying}
                  onPlay={() => onPlay(index)}
                  badge={<span className="pending-badge">Not synced</span>}
                  menuActions={[
                    { label: isOnline ? 'Upload now' : 'Upload now (offline)', onClick: () => onSyncOne(item.hash) },
                    { label: 'Remove from queue', danger: true, onClick: () => onCancel(item.hash) },
                  ]}
                />
              );
            })}
          </div>

          {pendingUploads.length > 1 && (
            <button className="fab" onClick={onShufflePlay} aria-label="Shuffle play local songs">
              🔀
            </button>
          )}

          <div className="sync-row">
            <button className="btn btn-primary" disabled={!isOnline || syncing} onClick={onSync}>
              {syncing
                ? `Uploading… (${syncProgress.done}/${syncProgress.total})`
                : isOnline
                  ? 'Upload All to Cloud'
                  : 'Upload All to Cloud (offline)'}
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
