'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        setError('Incorrect password.');
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl shadow-sm border"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>
          Admin Login
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Enter your password to access the puzzle admin.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border text-base outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--tile-bg)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
