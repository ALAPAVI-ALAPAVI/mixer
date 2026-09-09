import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listFoldersForUser, createFolder } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const folders = await listFoldersForUser(Number(session.user.id));
  return NextResponse.json({ folders });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { name } = await req.json();
  const trimmed = (name || '').toString().trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 });
  }
  if (trimmed.length > 255) {
    return NextResponse.json({ error: 'Folder name is too long.' }, { status: 400 });
  }

  const folder = await createFolder(Number(session.user.id), trimmed);
  return NextResponse.json({ folder }, { status: 201 });
}
