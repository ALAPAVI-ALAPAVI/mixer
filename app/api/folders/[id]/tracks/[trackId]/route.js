import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { removeTrackFromFolder } from '@/lib/db';

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const folderId = Number(params.id);
  const trackId = Number(params.trackId);

  await removeTrackFromFolder(folderId, trackId, Number(session.user.id));
  return NextResponse.json({ success: true });
}
