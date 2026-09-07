import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { put } from '@vercel/blob';
import { authOptions } from '@/lib/auth';
import { listTracksForUser, insertTrack } from '@/lib/db';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per track

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const tracks = await listTracksForUser(Number(session.user.id));
  return NextResponse.json({ tracks });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const title = (formData.get('title') || '').toString().trim();
  const artist = (formData.get('artist') || '').toString().trim();

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No audio file was sent.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 415 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File is larger than the 50MB limit.' }, { status: 413 });
  }

  const userId = Number(session.user.id);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blobPath = `users/${userId}/${Date.now()}-${safeName}`;

  const blob = await put(blobPath, file, {
    access: 'public',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const track = await insertTrack({
    userId,
    title: title || file.name.replace(/\.[^/.]+$/, ''),
    artist: artist || null,
    blobUrl: blob.url,
    sizeBytes: file.size,
  });

  return NextResponse.json({ track }, { status: 201 });
}
