'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { GridIcon, ListIcon, PlusIcon, MoreVerticalIcon } from '@/components/icons';

export default function FoldersScreen({ onOpenFolder, pendingCount, onRenameFolder, onDeleteFolder }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('grid'); // 'grid' | 'list'
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const [menuFolder, setMenuFolder] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  const localVirtualFolder = { id: 'local-virtual', name: 'Local (offline)', track_count: pendingCount, virtual: true };
  const displayFolders = [localVirtualFolder, ...folders];

  useEffect(() => {
    fetchFolders();
  }, []);

  async function fetchFolders() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/folders');
      if (!res.ok) throw new Error('Failed to load folders.');
      const data = await res.json();
      setFolders(data.folders);
    } catch {
      setError('Could not load your folders. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create folder.');
      setFolders((prev) => [...prev, { ...data.folder, track_count: 0 }]);
      setNewFolderName('');
      setShowAddModal(false);
    } catch (err) {
      setError(err.message || 'Could not create folder.');
    } finally {
      setCreating(false);
    }
  }

  function openMenu(e, folder) {
    e.stopPropagation();
    setMenuFolder(folder);
  }

  function startRename() {
    setRenameValue(menuFolder.name);
    setRenamingFolder(menuFolder);
    setMenuFolder(null);
  }

  async function handleRenameSubmit(e) {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || !renamingFolder) return;
    setSaving(true);
    try {
      await onRenameFolder(renamingFolder.id, trimmed);
      setFolders((prev) => prev.map((f) => (f.id === renamingFolder.id ? { ...f, name: trimmed } : f)));
      setRenamingFolder(null);
    } catch {
      setError('Could not rename that folder.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFolder() {
    const folder = menuFolder;
    setMenuFolder(null);
    try {
      await onDeleteFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    } catch {
      setError('Could not delete that folder.');
    }
  }

  function FolderMenuButton({ folder }) {
    if (folder.virtual || folder.is_default) return null;
    return (
      <button className="folder-menu-btn" onClick={(e) => openMenu(e, folder)} aria-label="Folder options">
        <MoreVerticalIcon width={16} height={16} />
      </button>
    );
  }

  return (
    <section>
      <div className="library-header">
        <h2>Folders</h2>
        <div className="view-toggle">
          <button
            className={`btn-toggle${view === 'grid' ? ' active' : ''}`}
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <GridIcon width={16} height={16} />
          </button>
          <button
            className={`btn-toggle${view === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
            aria-label="List view"
          >
            <ListIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading folders…</p>
      ) : view === 'grid' ? (
        <div className="folder-grid">
          {displayFolders.map((folder) => (
            <div key={folder.id} className="folder-tile" onClick={() => onOpenFolder(folder)}>
              <FolderMenuButton folder={folder} />
              <span className="folder-tile-name">{folder.name}</span>
              <span className="folder-tile-count">{folder.track_count} songs</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="track-list">
          {displayFolders.map((folder) => (
            <div key={folder.id} className="track-row folder-list-row" onClick={() => onOpenFolder(folder)}>
              <div className="track-meta">
                <div className="title">{folder.name}</div>
                <div className="artist">{folder.track_count} songs</div>
              </div>
              <FolderMenuButton folder={folder} />
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setShowAddModal(true)} aria-label="Add folder">
        <PlusIcon />
      </button>

      {showAddModal && (
        <Modal title="New folder" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreateFolder}>
            <div className="field">
              <label htmlFor="folder-name">Folder name</label>
              <input
                id="folder-name"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Workout mix"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={creating}>
              {creating ? 'Creating…' : 'Create folder'}
            </button>
          </form>
        </Modal>
      )}

      {menuFolder && (
        <Modal title={menuFolder.name} onClose={() => setMenuFolder(null)}>
          <div className="menu-list">
            <button className="btn btn-ghost menu-item" onClick={startRename}>
              Rename
            </button>
            <button className="btn btn-danger menu-item" onClick={handleDeleteFolder}>
              Delete folder
            </button>
          </div>
        </Modal>
      )}

      {renamingFolder && (
        <Modal title="Rename folder" onClose={() => setRenamingFolder(null)}>
          <form onSubmit={handleRenameSubmit}>
            <div className="field">
              <label htmlFor="rename-folder">Folder name</label>
              <input
                id="rename-folder"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
