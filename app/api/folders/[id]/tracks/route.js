import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addTrackToFolder } from '@/lib/db';

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { trackId } = await req.json();
  if (!trackId) {
    return NextResponse.json({ error: 'trackId is required.' }, { status: 400 });
  }

  const folderId = Number(params.id);
  await addTrackToFolder(folderId, Number(trackId), Number(session.user.id));
  return NextResponse.json({ success: true });
}
