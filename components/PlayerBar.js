'use client';

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function PlayerBar({ track, isPlaying, currentTime, duration, onTogglePlayPause, onNext, onPrev, onSeek }) {
  if (!track) {
    return (
      <div className="player-bar">
        <div className="now-playing">
          <div className="title" style={{ color: 'var(--text-muted)' }}>
            Nothing playing
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-bar">
      <div className="now-playing">
        <div className="title">{track.title}</div>
        {track.artist && <div className="artist">{track.artist}</div>}
      </div>

      <div className="player-controls">
        <button className="btn-icon" onClick={onPrev} aria-label="Previous">
          ⏮
        </button>
        <button className="btn-icon" onClick={onTogglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button className="btn-icon" onClick={onNext} aria-label="Next">
          ⏭
        </button>
      </div>

      <div className="seek-row">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
