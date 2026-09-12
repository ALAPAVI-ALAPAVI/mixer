'use client';

import { useRef, useState } from 'react';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPrevIcon } from '@/components/icons';

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function PlayerBar({ track, isPlaying, currentTime, duration, onTogglePlayPause, onNext, onPrev, onSeek, onExpand }) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(null);
  const draggingRef = useRef(false);

  function handlePointerDown(e) {
    // Don't hijack dragging the seek bar itself — only the rest of the bar
    // (tapping/sliding it up) opens the full Now Playing screen.
    if (e.target.closest('.seek-row')) return;
    startYRef.current = e.clientY;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current || startYRef.current === null) return;
    const delta = e.clientY - startYRef.current;
    setDragY(delta < 0 ? Math.max(delta, -120) : 0);
  }

  function handlePointerUp(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY < -40) {
      onExpand();
    }
    setDragY(0);
    startYRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

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
    <div
      className="player-bar"
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="now-playing" onClick={onExpand} role="button" tabIndex={0}>
        <div className="title">{track.title}</div>
        {track.artist && <div className="artist">{track.artist}</div>}
      </div>

      <div className="player-controls">
        <button className="btn-icon" onClick={onPrev} aria-label="Previous">
          <SkipPrevIcon width={18} height={18} />
        </button>
        <button className="btn-icon" onClick={onTogglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
        </button>
        <button className="btn-icon" onClick={onNext} aria-label="Next">
          <SkipNextIcon width={18} height={18} />
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
