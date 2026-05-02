'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Image from 'next/image';

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
    const d = new Date();
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fetch(`/api/puzzle/today?date=${localDate}`)
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
      style={{ backgroundColor: '#ba81c5' }}
      className="min-h-screen flex flex-col items-center justify-center px-6"
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Logo */}
        <div className="w-25 h-25 rounded-xl overflow-hidden">
          <Image
            src="/connections.svg"
            alt="Connections"
            width={80}
            height={80}
            className="w-full h-full"
          />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1
            className="text-5xl font-black tracking-tight"
            style={{ color: '#1a1a1a', fontFamily: 'var(--font-karnak)' }}
          >
            Connections
          </h1>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={() => info?.exists && router.push('/play')}
            disabled={loading || !info?.exists}
            className="btn-hover w-full py-4 rounded-full font-bold text-lg"
            style={{
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              opacity: loading || !info?.exists ? 0.5 : 1,
              cursor: loading || !info?.exists ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Loading…' : info?.exists ? "Play Today's" : 'No puzzle today'}
          </button>
          <button
            onClick={() => router.push('/custom')}
            className="btn-hover-outline w-full py-3 rounded-full font-bold text-base"
            style={{
              backgroundColor: 'transparent',
              color: '#1a1a1a',
              border: '2px solid #1a1a1a',
              cursor: 'pointer',
              opacity: 0.85,
            }}
          >
            Play Custom
          </button>
          <button
            onClick={() => router.push('/leaderboard')}
            className="btn-hover-outline w-full py-2.5 rounded-full font-bold text-sm"
            style={{
              backgroundColor: 'transparent',
              color: '#1a1a1a',
              border: '1.5px solid rgba(26,26,26,0.35)',
              cursor: 'pointer',
              opacity: 0.75,
            }}
          >
            Leaderboard
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
