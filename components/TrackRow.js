'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { PlayIcon, PauseIcon, MoreVerticalIcon, CheckIcon } from '@/components/icons';

export default function TrackRow({
  track,
  isCurrent,
  isPlaying,
  onPlay,
  badge,
  menuActions = [],
  selectable = false,
  selected = false,
  onToggleSelect,
}) {
  const [showMenu, setShowMenu] = useState(false);

  const tapHandler = selectable ? onToggleSelect : onPlay;

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tapHandler();
    }
  }

  return (
    <div className={`track-row${isCurrent ? ' active' : ''}${selected ? ' selected' : ''}`}>
      <div
        className="track-row-tap"
        onClick={tapHandler}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        {selectable ? (
          <span className={`track-checkbox${selected ? ' checked' : ''}`} aria-hidden="true">
            {selected && <CheckIcon width={14} height={14} />}
          </span>
        ) : (
          <span className="track-play-indicator" aria-hidden="true">
            {isCurrent && isPlaying ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
          </span>
        )}
        <div className="track-meta">
          <div className="title">{track.title}</div>
          {track.artist && <div className="artist">{track.artist}</div>}
        </div>
      </div>

      {badge}

      {!selectable && menuActions.length > 0 && (
        <button
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(true);
          }}
          aria-label="More options"
        >
          <MoreVerticalIcon width={16} height={16} />
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
