const DB_NAME = 'mixer-offline';
const DB_VERSION = 2;
const STORE_NAME = 'tracks'; // downloaded-for-offline-playback songs
const PENDING_STORE = 'pending-uploads'; // songs queued to upload once online
const META_STORE = 'meta'; // small cache of the last-known cloud track list

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'hash' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Downloaded-for-offline-playback tracks ---

export async function saveTrackOffline(track) {
  const response = await fetch(track.blob_url);
  if (!response.ok) throw new Error('Could not download track for offline use.');
  const blob = await response.blob();

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      id: track.id,
      blob,
      title: track.title,
      artist: track.artist,
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineTrackBlob(trackId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(trackId);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => reject(req.error);
  });
}

export async function isTrackOffline(trackId) {
  const blob = await getOfflineTrackBlob(trackId);
  return !!blob;
}

export async function removeOfflineTrack(trackId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(trackId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOfflineTrackIds() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Pending uploads (queued locally, not yet synced to the cloud) ---

export async function queuePendingUpload({ hash, blob, title, artist, fileName, fileType }) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).put({
      hash,
      blob,
      title,
      artist: artist || null,
      fileName,
      fileType,
      queuedAt: Date.now(),
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPendingUploads() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readonly');
    const req = tx.objectStore(PENDING_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingUpload(hash) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).delete(hash);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function hasPendingUpload(hash) {
  const all = await listPendingUploads();
  return all.some((p) => p.hash === hash);
}

// --- Cached cloud track list (so the library still shows something if you
// reload the page while offline, instead of going blank) ---

export async function cacheTracksMeta(tracks) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key: 'cloud-tracks', value: tracks, updatedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedTracksMeta() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('cloud-tracks');
    req.onsuccess = () => resolve(req.result ? req.result.value : []);
    req.onerror = () => reject(req.error);
  });
}
