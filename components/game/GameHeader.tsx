'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function GameHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPlayPage = pathname === '/play' || pathname === '/play/custom';
  if (!isPlayPage) return null;

  const dateParam = searchParams.get('date');
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isPastDate = pathname === '/play' && !!dateParam && dateParam !== todayStr;
  const isTodayActive = pathname === '/play' && !isPastDate;
  const isCustomActive = pathname === '/play/custom' || isPastDate;

  return (
    <div className="w-full flex justify-center py-3">
      <div className="flex items-center gap-1 p-1 rounded-full" style={{ backgroundColor: 'var(--tile-bg)' }}>
        <button
          onClick={() => router.push('/play')}
          className={`${isTodayActive ? 'btn-hover' : 'btn-hover-ghost'} px-4 py-1.5 rounded-full font-bold text-sm`}
          style={
            isTodayActive
              ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }
              : { backgroundColor: 'transparent', color: 'var(--text)', opacity: 0.6 }
          }
        >
          Today&apos;s
        </button>
        <button
          onClick={() => router.push('/custom')}
          className={`${isCustomActive ? 'btn-hover' : 'btn-hover-ghost'} px-4 py-1.5 rounded-full font-bold text-sm`}
          style={
            isCustomActive
              ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }
              : { backgroundColor: 'transparent', color: 'var(--text)', opacity: 0.6 }
          }
        >
          Custom
        </button>
      </div>
    </div>
  );
}
