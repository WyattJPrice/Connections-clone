'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface TodayInfo {
  puzzleNumber: number;
  puzzleDate: string;
  exists: boolean;
}

export default function SplashPage() {
  const router = useRouter();
  const [info, setInfo] = useState<TodayInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/puzzle/today')
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formattedDate = info?.puzzleDate
    ? format(new Date(info.puzzleDate + 'T00:00:00'), 'MMMM d, yyyy')
    : format(new Date(), 'MMMM d, yyyy');

  return (
    <div
      style={{ backgroundColor: '#a594d4' }}
      className="min-h-screen flex flex-col items-center justify-center px-6"
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Logo */}
        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-black/20">
          <ConnectionsLogo />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1
            className="text-5xl font-black tracking-tight"
            style={{ color: '#1a1a1a', fontFamily: 'Georgia, serif' }}
          >
            Connections
          </h1>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={() => info?.exists && router.push('/play')}
            disabled={loading || !info?.exists}
            className="w-full py-4 rounded-full font-bold text-lg transition-all"
            style={{
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              opacity: loading || !info?.exists ? 0.5 : 1,
              cursor: loading || !info?.exists ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Loading…' : info?.exists ? 'Play' : 'No puzzle today'}
          </button>
        </div>

        {/* Date and puzzle number */}
        <div className="text-center" style={{ color: '#1a1a1a' }}>
          <p className="font-bold text-lg">{formattedDate}</p>
          {info?.puzzleNumber != null && (
            <p className="text-base opacity-80">No. {info.puzzleNumber}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionsLogo() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="80" height="80" fill="#a594d4" />
      {/* 3x3 grid of squares representing connections */}
      <rect x="4" y="4" width="22" height="22" rx="3" fill="#f9df6d" />
      <rect x="30" y="4" width="22" height="22" rx="3" fill="#f9df6d" />
      <rect x="56" y="4" width="20" height="22" rx="3" fill="#ffffff" />
      <rect x="4" y="30" width="22" height="22" rx="3" fill="#ba81c5" />
      <rect x="30" y="30" width="22" height="22" rx="3" fill="#ba81c5" />
      <rect x="56" y="30" width="20" height="22" rx="3" fill="#ba81c5" />
      <rect x="4" y="56" width="22" height="20" rx="3" fill="#ffffff" />
      <rect x="30" y="56" width="22" height="20" rx="3" fill="#ba81c5" />
      <rect x="56" y="56" width="20" height="20" rx="3" fill="#ffffff" />
    </svg>
  );
}
