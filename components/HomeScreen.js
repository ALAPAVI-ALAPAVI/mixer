'use client';

import { useRef } from 'react';

const TILES = [
  { key: 'folders', label: 'Folders', icon: '▤' },
  { key: 'allsongs', label: 'All Songs', icon: '♪' },
  { key: 'account', label: 'Account', icon: '☺' },
];

export default function HomeScreen({ userName, onNavigate, uploading, uploadError, uploadNotice, onUpload }) {
  const fileInputRef = useRef(null);

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <section>
      <div className="library-header">
        <h2>Welcome back{userName ? `, ${userName}` : ''}</h2>
      </div>

      <div className="upload-hero">
        <p className="upload-hero-text">Add a song from your device — works offline too.</p>
        <button className="btn btn-primary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? 'Processing…' : 'Upload a song'}
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChosen} />
      </div>

      {uploadError && <div className="form-error">{uploadError}</div>}
      {uploadNotice && !uploadError && (
        <div className="form-error" style={{ background: 'rgba(232,163,61,0.12)', borderColor: 'rgba(232,163,61,0.4)', color: 'var(--accent)' }}>
          {uploadNotice}
        </div>
      )}

      <div className="home-tiles">
        {TILES.map((tile) => (
          <button key={tile.key} className="home-tile" onClick={() => onNavigate(tile.key)}>
            <span className="home-tile-icon" aria-hidden="true">
              {tile.icon}
            </span>
            <span className="home-tile-label">{tile.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
