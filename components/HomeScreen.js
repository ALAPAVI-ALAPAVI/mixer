'use client';

import { useRef } from 'react';

export default function HomeScreen({ userName, uploading, uploadError, uploadNotice, onUpload }) {
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
        <div className="form-error" style={{ background: 'rgba(125,15,31,0.18)', borderColor: 'rgba(125,15,31,0.5)', color: 'var(--accent-text)' }}>
          {uploadNotice}
        </div>
      )}
    </section>
  );
}
