'use client';

import { signOut } from 'next-auth/react';

export default function AccountScreen({ userName }) {
  const initial = (userName || '?').trim().charAt(0).toUpperCase();

  return (
    <section>
      <div className="library-header">
        <h2>Account</h2>
      </div>

      <div className="account-card">
        <div className="account-avatar">{initial}</div>
        <div className="account-name">{userName}</div>
        <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/login' })}>
          Sign out
        </button>
      </div>
    </section>
  );
}
