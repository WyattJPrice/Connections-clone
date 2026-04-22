'use client';

interface MistakeDotsProps {
  remaining: number;
}

export function MistakeDots({ remaining }: MistakeDotsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Mistakes remaining:
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i < remaining ? '#6b6b63' : 'transparent',
              border: i < remaining ? 'none' : '2px solid #6b6b63',
              opacity: i < remaining ? 1 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
