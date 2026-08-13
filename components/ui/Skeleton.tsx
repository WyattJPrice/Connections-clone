import { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={`skeleton ${className ?? ''}`} style={style} aria-hidden="true" />;
}

interface CalendarSkeletonProps {
  className?: string;
}

export function CalendarSkeleton({ className }: CalendarSkeletonProps) {
  return (
    <div className={`rounded-xl border overflow-hidden ${className ?? ''}`} style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: 'var(--tile-bg)' }}>
        <Skeleton className="w-7 h-7 rounded" />
        <Skeleton className="w-32 h-4 rounded" />
        <Skeleton className="w-7 h-7 rounded" />
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3 rounded" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7 gap-1.5 mb-1.5">
            {Array.from({ length: 7 }).map((_, col) => (
              <Skeleton key={col} className="aspect-square rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CategoryTilesSkeletonProps {
  count?: number;
  columns?: string;
  className?: string;
}

export function CategoryTilesSkeleton({ count = 8, columns = 'grid-cols-2', className }: CategoryTilesSkeletonProps) {
  return (
    <div className={`grid ${columns} gap-2 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border flex items-center gap-3 px-4"
          style={{ height: 80, borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}
        >
          <Skeleton className="w-5 h-5 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <Skeleton className="h-3.5 rounded w-3/4" />
            <Skeleton className="h-3 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}
        >
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <Skeleton className="h-3.5 rounded w-1/3" />
            <Skeleton className="h-3 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PuzzleBoardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center w-full max-w-170 mx-auto px-3 pb-8 ${className ?? ''}`}>
      <Skeleton className="w-52 h-4 rounded mb-3" />
      <div className="w-full flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, row) => (
          <Skeleton key={row} className="w-full rounded-lg" style={{ minHeight: 80 }} />
        ))}
        <div className="grid grid-cols-[repeat(4,85px)] sm:grid-cols-[repeat(4,150px)] gap-2 mx-auto w-fit">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="rounded-md" style={{ width: 85, height: 62 }} />
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-col items-center gap-4 w-full">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-3 h-3 rounded-full" />
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton className="w-28 h-10 rounded-full" />
          <Skeleton className="w-32 h-10 rounded-full" />
          <Skeleton className="w-24 h-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function FullPageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`min-h-screen flex flex-col justify-center items-center gap-3 ${className ?? ''}`}
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <Skeleton className="w-64 h-6 rounded" />
      <Skeleton className="w-40 h-4 rounded" />
    </div>
  );
}