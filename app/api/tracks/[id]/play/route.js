import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { incrementPlayCount } from '@/lib/db';

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const trackId = Number(params.id);
  await incrementPlayCount(trackId, Number(session.user.id));
  return NextResponse.json({ success: true });
}
