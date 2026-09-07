import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '@/components/AppShell';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  return <AppShell userName={session.user.name || session.user.email} />;
}
