'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';

export default function FolderPickerModal({ trackId, onAddToFolder, onClose }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/folders')
      .then((res) => res.json())
      .then((data) => setFolders(data.folders || []))
      .catch(() => setFolders([]))
      .finally(() => setLoading(false));
  }, []);

  async function handlePick(folderId) {
    try {
      await onAddToFolder(trackId, folderId);
      setMessage('Added to folder.');
      setTimeout(onClose, 800);
    } catch {
      setMessage('Could not add to that folder.');
    }
  }

  return (
    <Modal title="Add to folder" onClose={onClose}>
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : folders.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>You don't have any folders yet.</p>
      ) : (
        <div className="menu-list">
          {folders.map((f) => (
            <button key={f.id} className="btn btn-ghost menu-item" onClick={() => handlePick(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      {message && <p style={{ color: 'var(--accent)', marginTop: '10px' }}>{message}</p>}
    </Modal>
  );
}
