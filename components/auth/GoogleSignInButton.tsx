'use client';

import { signInWithGoogle } from '@/lib/auth';
import { useState } from 'react';

interface Props {
  label?: string;
  className?: string;
}

export function GoogleSignInButton({ label = 'Sign in with Google', className }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`btn-hover-outline${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '12px 24px',
        borderRadius: '9999px',
        border: '1.5px solid var(--border)',
        backgroundColor: 'var(--tile-bg)',
        color: 'var(--text)',
        fontWeight: 700,
        fontSize: '15px',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <GoogleLogo />
      {loading ? 'Signing in…' : label}
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.7 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10.1-1.9 13.8-5.1l-6.4-5.4C29.3 35.2 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.4l-6.6 5.1C9.4 39.4 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.4 4.2-4.5 5.5l6.4 5.4C40.9 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
  );
}
