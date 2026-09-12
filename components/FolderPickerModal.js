'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';

// Accepts either a single trackId or an array trackIds for bulk-adding
// multiple selected songs to one folder at once.
export default function FolderPickerModal({ trackId, trackIds, onAddToFolder, onClose }) {
  const ids = trackIds || (trackId != null ? [trackId] : []);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/folders')
      .then((res) => res.json())
      .then((data) => setFolders(data.folders || []))
      .catch(() => setFolders([]))
      .finally(() => setLoading(false));
  }, []);

  async function handlePick(folderId) {
    setSaving(true);
    try {
      for (const id of ids) {
        await onAddToFolder(id, folderId);
      }
      setMessage(ids.length > 1 ? `Added ${ids.length} songs to folder.` : 'Added to folder.');
      setTimeout(onClose, 800);
    } catch {
      setMessage('Could not add to that folder.');
    } finally {
      setSaving(false);
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
            <button key={f.id} className="btn btn-ghost menu-item" disabled={saving} onClick={() => handlePick(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      {message && <p style={{ color: 'var(--accent)', marginTop: '10px' }}>{message}</p>}
    </Modal>
  );
}
