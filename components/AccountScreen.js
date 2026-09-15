'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export default function AccountScreen({ userName, userEmail }) {
  const initial = (userName || '?').trim().charAt(0).toUpperCase();
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !stats) {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/account/stats');
        if (!res.ok) throw new Error('Failed to load stats.');
        const data = await res.json();
        setStats(data);
      } catch {
        setError('Could not load your account stats.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <section className="account-section">
      <div className="library-header">
        <h2>Account</h2>
      </div>

      <button
        className={`account-card${expanded ? ' expanded' : ''}`}
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <div className="account-avatar">{initial}</div>
        <div className="account-name">{userName}</div>

        {expanded && (
          <div className="account-details">
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : error ? (
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            ) : stats ? (
              <>
                <div className="account-detail-row">
                  <span>Email</span>
                  <span>{userEmail}</span>
                </div>
                <div className="account-detail-row">
                  <span>Username</span>
                  <span>{userName}</span>
                </div>
                <div className="account-detail-row">
                  <span>Total songs</span>
                  <span>{stats.totalSongs}</span>
                </div>
                <div className="account-detail-row">
                  <span>Most played</span>
                  <span>
                    {stats.mostPlayed
                      ? `${stats.mostPlayed.title} (${stats.mostPlayed.play_count}×)`
                      : 'None yet'}
                  </span>
                </div>
                <div className="account-detail-row">
                  <span>Total play time</span>
                  <span>{formatDuration(stats.totalDurationSeconds)}</span>
                </div>
              </>
            ) : null}
          </div>
        )}
      </button>

      <button className="btn btn-ghost account-signout" onClick={() => signOut({ callbackUrl: '/login' })}>
        Sign out
      </button>
    </section>
  );
}
