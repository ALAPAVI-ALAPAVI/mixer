import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { handleUpload } from '@vercel/blob/client';
import { authOptions } from '@/lib/auth';
import { insertTrack, addTrackToDefaultFolder, findTrackByHash } from '@/lib/db';

const ALLOWED_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
];
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB - safe now since files go straight to Blob, not through this function

// Thrown when the same song (by content hash) already exists for this user.
// The client checks specifically for this text to distinguish "rejected on
// purpose" from "failed because we're offline" - see Library.js.
const DUPLICATE_MESSAGE = 'DUPLICATE_TRACK';

export async function POST(req) {
  const body = await req.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // This callback runs on the FIRST call, made directly by the browser
        // with the user's session cookie attached — safe to check auth here.
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          throw new Error('Not signed in.');
        }
        const userId = Number(session.user.id);

        let meta = {};
        try {
          meta = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          meta = {};
        }

        // Authoritative duplicate check against the database — catches cases
        // the client's own local check can't, like the same song already
        // having been uploaded from a different device.
        if (meta.hash) {
          const existing = await findTrackByHash(userId, meta.hash);
          if (existing) {
            throw new Error(DUPLICATE_MESSAGE);
          }
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId,
            title: meta.title || 'Untitled',
            artist: meta.artist || null,
            hash: meta.hash || null,
            duration: meta.duration || null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Runs as a SECOND, separate call — this one made server-to-server by
        // Vercel's Blob infrastructure once the file has fully landed in Blob
        // storage. It carries no session cookie at all (there's no browser
        // involved), so identity comes from tokenPayload we set above instead.
        const meta = tokenPayload ? JSON.parse(tokenPayload) : {};
        if (!meta.userId) return;

        const track = await insertTrack({
          userId: meta.userId,
          title: meta.title || 'Untitled',
          artist: meta.artist || null,
          blobUrl: blob.url,
          sizeBytes: null,
          contentHash: meta.hash || null,
          durationSeconds: meta.duration || null,
        });

        // Every uploaded song automatically lands in the default folder too.
        await addTrackToDefaultFolder(meta.userId, track.id);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error('Blob upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed.' }, { status: 400 });
  }
}
