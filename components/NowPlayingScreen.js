'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import {
  ChevronDownIcon,
  MoreVerticalIcon,
  ShuffleIcon,
  SkipPrevIcon,
  SkipNextIcon,
  PlayIcon,
  PauseIcon,
  LoopIcon,
} from '@/components/icons';

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function NowPlayingScreen({
  track,
  isPlaying,
  currentTime,
  duration,
  shuffle,
  loop,
  onClose,
  onTogglePlayPause,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onToggleLoop,
  onDelete,
  onRemovePending,
  onAddToFolder,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [addedMessage, setAddedMessage] = useState('');

  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!showFolderPicker) return;
    setFoldersLoading(true);
    fetch('/api/folders')
      .then((res) => res.json())
      .then((data) => setFolders(data.folders || []))
      .catch(() => setFolders([]))
      .finally(() => setFoldersLoading(false));
  }, [showFolderPicker]);

  async function handlePickFolder(folderId) {
    try {
      await onAddToFolder(track.id, folderId);
      setAddedMessage('Added to folder.');
      setTimeout(() => {
        setAddedMessage('');
        setShowFolderPicker(false);
        setShowMenu(false);
      }, 900);
    } catch {
      setAddedMessage('Could not add to that folder.');
    }
  }

  function handleDeleteClick() {
    if (track.isPending) {
      onRemovePending(track.hash);
    } else {
      onDelete(track);
    }
    setShowMenu(false);
  }

  // Dragging down on the header/art/meta area (not the seek bar or the
  // control buttons) collapses back to the mini player.
  function handlePointerDown(e) {
    if (e.target.closest('.np-seek') || e.target.closest('.np-controls')) return;
    startYRef.current = e.clientY;
    draggingRef.current = true;
  }

  function handlePointerMove(e) {
    if (!draggingRef.current || startYRef.current === null) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) {
      setDragY(Math.min(delta, 300));
    }
  }

  function handlePointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > 90) {
      onClose();
    }
    setDragY(0);
    startYRef.current = null;
  }

  return (
    <div className="now-playing-overlay">
      <div
        className="now-playing-screen"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="np-header">
          <button className="btn-icon" onClick={onClose} aria-label="Minimize">
            <ChevronDownIcon />
          </button>
          <span className="np-header-label">Now Playing</span>
          <button className="btn-icon" onClick={() => setShowMenu(true)} aria-label="More options">
            <MoreVerticalIcon />
          </button>
        </div>

        <div className="np-art" aria-hidden="true" />

        <div className="np-meta">
          <h2 className="np-title">{track.title}</h2>
          {track.artist && <p className="np-artist">{track.artist}</p>}
          {track.isPending && <span className="pending-badge">Not synced yet</span>}
        </div>

        <div className="seek-row np-seek">
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

        <div className="np-controls">
          <button
            className={`btn-icon${shuffle ? ' active' : ''}`}
            onClick={onToggleShuffle}
            aria-label="Shuffle"
          >
            <ShuffleIcon width={18} height={18} />
          </button>
          <button className="btn-icon np-skip" onClick={onPrev} aria-label="Previous">
            <SkipPrevIcon width={26} height={26} />
          </button>
          <button className="np-play-btn" onClick={onTogglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon width={28} height={28} /> : <PlayIcon width={28} height={28} />}
          </button>
          <button className="btn-icon np-skip" onClick={onNext} aria-label="Next">
            <SkipNextIcon width={26} height={26} />
          </button>
          <button className={`btn-icon${loop ? ' active' : ''}`} onClick={onToggleLoop} aria-label="Loop">
            <LoopIcon width={18} height={18} />
          </button>
        </div>
      </div>

      {showMenu && (
        <Modal title="Song options" onClose={() => setShowMenu(false)}>
          <div className="menu-list">
            {!track.isPending && (
              <button className="btn btn-ghost menu-item" onClick={() => { setShowMenu(false); setShowFolderPicker(true); }}>
                Add to folder
              </button>
            )}
            <button className="btn btn-danger menu-item" onClick={handleDeleteClick}>
              {track.isPending ? 'Remove from queue' : 'Delete song'}
            </button>
          </div>
        </Modal>
      )}

      {showFolderPicker && (
        <Modal title="Add to folder" onClose={() => setShowFolderPicker(false)}>
          {foldersLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <div className="menu-list">
              {folders.map((f) => (
                <button key={f.id} className="btn btn-ghost menu-item" onClick={() => handlePickFolder(f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          {addedMessage && <p style={{ color: 'var(--accent)', marginTop: '10px' }}>{addedMessage}</p>}
        </Modal>
      )}
    </div>
  );
}
