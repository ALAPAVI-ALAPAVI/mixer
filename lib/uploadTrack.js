import { upload } from '@vercel/blob/client';

// Thrown by the server when this exact file (by content hash) already exists.
export const DUPLICATE_TRACK_ERROR = 'DUPLICATE_TRACK';

export async function uploadTrackFile(file, { hash, title, artist, duration } = {}) {
  return upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/tracks/upload-url',
    clientPayload: JSON.stringify({ title, artist, hash, duration }),
  });
}
