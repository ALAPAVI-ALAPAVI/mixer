import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFolderForUser, listTracksInFolder, deleteFolder } from '@/lib/db';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const folderId = Number(params.id);

  const folder = await getFolderForUser(folderId, userId);
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });
  }

  const tracks = await listTracksInFolder(folderId, userId);
  return NextResponse.json({ folder, tracks });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const folderId = Number(params.id);

  const folder = await getFolderForUser(folderId, userId);
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });
  }
  if (folder.is_default) {
    return NextResponse.json({ error: "The default folder can't be deleted." }, { status: 400 });
  }

  await deleteFolder(folderId, userId);
  return NextResponse.json({ success: true });
}
