'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

export default function TrackRow({ track, isCurrent, isPlaying, onPlay, badge, menuActions = [] }) {
  const [showMenu, setShowMenu] = useState(false);

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay();
    }
  }

  return (
    <div className={`track-row${isCurrent ? ' active' : ''}`}>
      <div
        className="track-row-tap"
        onClick={onPlay}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <span className="track-play-indicator" aria-hidden="true">
          {isCurrent && isPlaying ? '❚❚' : '▶'}
        </span>
        <div className="track-meta">
          <div className="title">{track.title}</div>
          {track.artist && <div className="artist">{track.artist}</div>}
        </div>
      </div>

      {badge}

      {menuActions.length > 0 && (
        <button
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(true);
          }}
          aria-label="More options"
        >
          ⋮
        </button>
      )}

      {showMenu && (
        <Modal title={track.title} onClose={() => setShowMenu(false)}>
          <div className="menu-list">
            {menuActions.map((action, i) => (
              <button
                key={i}
                className={`btn ${action.danger ? 'btn-danger' : 'btn-ghost'} menu-item`}
                onClick={() => {
                  setShowMenu(false);
                  action.onClick();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
