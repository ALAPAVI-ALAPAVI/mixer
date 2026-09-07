import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { del } from '@vercel/blob';
import { authOptions } from '@/lib/auth';
import { getTrackForUser, deleteTrack } from '@/lib/db';

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const trackId = Number(params.id);

  const track = await getTrackForUser(trackId, userId);
  if (!track) {
    return NextResponse.json({ error: 'Track not found.' }, { status: 404 });
  }

  try {
    await del(track.blob_url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    // If the blob is already gone, don't block deleting the DB row.
    console.warn('Could not delete blob (continuing anyway):', err.message);
  }

  await deleteTrack(trackId, userId);
  return NextResponse.json({ success: true });
}
