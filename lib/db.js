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
