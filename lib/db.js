import { neon } from '@neondatabase/serverless';

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Add it to .env.local (see .env.example).');
    }
    _client = neon(process.env.DATABASE_URL);
  }
  return _client;
}

// Lazily creates the Neon client on first real query instead of at import time,
// so `next build` doesn't fail just because DATABASE_URL isn't set yet locally.
export const sql = (...args) => getClient()(...args);

let schemaReady = null;

// Lazily creates tables on first use so there's no separate migration step to run.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password_hash VARCHAR(255),
        google_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS tracks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        artist VARCHAR(500),
        blob_url TEXT NOT NULL,
        size_bytes BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS folder_tracks (
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (folder_id, track_id)
      );
    `;
  })();

  return schemaReady;
}

export async function findUserByEmail(email) {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
  return rows[0] || null;
}

export async function findUserById(id) {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function createUserWithPassword(email, passwordHash, name) {
  await ensureSchema();
  const rows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name || null})
    RETURNING id, email, name;
  `;
  return rows[0];
}

export async function findOrCreateGoogleUser({ email, name, googleId }) {
  await ensureSchema();
  const existing = await findUserByEmail(email);
  if (existing) {
    if (!existing.google_id) {
      await sql`UPDATE users SET google_id = ${googleId} WHERE id = ${existing.id}`;
    }
    return existing;
  }
  const rows = await sql`
    INSERT INTO users (email, name, google_id)
    VALUES (${email}, ${name || null}, ${googleId})
    RETURNING id, email, name;
  `;
  return rows[0];
}

export async function listTracksForUser(userId) {
  await ensureSchema();
  return sql`SELECT id, title, artist, blob_url, size_bytes, created_at
             FROM tracks WHERE user_id = ${userId} ORDER BY created_at DESC`;
}

export async function insertTrack({ userId, title, artist, blobUrl, sizeBytes }) {
  await ensureSchema();
  const rows = await sql`
    INSERT INTO tracks (user_id, title, artist, blob_url, size_bytes)
    VALUES (${userId}, ${title}, ${artist || null}, ${blobUrl}, ${sizeBytes || null})
    RETURNING id, title, artist, blob_url, size_bytes, created_at;
  `;
  return rows[0];
}

export async function getTrackForUser(trackId, userId) {
  await ensureSchema();
  const rows = await sql`SELECT * FROM tracks WHERE id = ${trackId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

export async function deleteTrack(trackId, userId) {
  await ensureSchema();
  await sql`DELETE FROM tracks WHERE id = ${trackId} AND user_id = ${userId}`;
}

// --- Folders ---

const DEFAULT_FOLDER_NAME = 'All Uploads';

export async function getOrCreateDefaultFolder(userId) {
  await ensureSchema();
  const existing = await sql`
    SELECT * FROM folders WHERE user_id = ${userId} AND is_default = true LIMIT 1
  `;
  if (existing[0]) return existing[0];

  const rows = await sql`
    INSERT INTO folders (user_id, name, is_default)
    VALUES (${userId}, ${DEFAULT_FOLDER_NAME}, true)
    RETURNING *;
  `;
  return rows[0];
}

export async function listFoldersForUser(userId) {
  await ensureSchema();
  await getOrCreateDefaultFolder(userId); // make sure it always exists and shows up

  return sql`
    SELECT f.id, f.name, f.is_default, f.created_at,
           COUNT(ft.track_id)::int AS track_count
    FROM folders f
    LEFT JOIN folder_tracks ft ON ft.folder_id = f.id
    WHERE f.user_id = ${userId}
    GROUP BY f.id
    ORDER BY f.is_default DESC, f.created_at ASC;
  `;
}

export async function createFolder(userId, name) {
  await ensureSchema();
  const rows = await sql`
    INSERT INTO folders (user_id, name, is_default)
    VALUES (${userId}, ${name}, false)
    RETURNING id, name, is_default, created_at;
  `;
  return rows[0];
}

export async function getFolderForUser(folderId, userId) {
  await ensureSchema();
  const rows = await sql`
    SELECT * FROM folders WHERE id = ${folderId} AND user_id = ${userId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function deleteFolder(folderId, userId) {
  await ensureSchema();
  // The default folder can't be deleted — it's the home for every uploaded song.
  await sql`DELETE FROM folders WHERE id = ${folderId} AND user_id = ${userId} AND is_default = false`;
}

export async function listTracksInFolder(folderId, userId) {
  await ensureSchema();
  return sql`
    SELECT t.id, t.title, t.artist, t.blob_url, t.size_bytes, t.created_at
    FROM tracks t
    JOIN folder_tracks ft ON ft.track_id = t.id
    WHERE ft.folder_id = ${folderId} AND t.user_id = ${userId}
    ORDER BY ft.added_at DESC;
  `;
}

export async function addTrackToFolder(folderId, trackId, userId) {
  await ensureSchema();
  // Ownership check happens implicitly: the join only succeeds if both the
  // folder and the track belong to this user.
  await sql`
    INSERT INTO folder_tracks (folder_id, track_id)
    SELECT ${folderId}, ${trackId}
    WHERE EXISTS (SELECT 1 FROM folders WHERE id = ${folderId} AND user_id = ${userId})
      AND EXISTS (SELECT 1 FROM tracks WHERE id = ${trackId} AND user_id = ${userId})
    ON CONFLICT DO NOTHING;
  `;
}

export async function addTrackToDefaultFolder(userId, trackId) {
  const folder = await getOrCreateDefaultFolder(userId);
  await addTrackToFolder(folder.id, trackId, userId);
}

// Removes a song from a folder only — the song itself, and its membership in
// every other folder, is untouched.
export async function removeTrackFromFolder(folderId, trackId, userId) {
  await ensureSchema();
  await sql`
    DELETE FROM folder_tracks
    WHERE folder_id = ${folderId}
      AND track_id = ${trackId}
      AND EXISTS (SELECT 1 FROM folders WHERE id = ${folderId} AND user_id = ${userId})
  `;
}
