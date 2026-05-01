'use client';

interface TileProps {
  word: string;
  selected: boolean;
  solved: boolean;
  shaking: boolean;
  jumping: boolean;
  merging: boolean;
  jumpDelay: number;
  onClick: () => void;
}

export function Tile({ word, selected, solved, shaking, jumping, merging, jumpDelay, onClick }: TileProps) {
  if (solved) return null;

  return (
    <button
      onClick={onClick}
      className={`
        tile-hover
        flex items-center justify-center w-full
        h-36 sm:h-20
        rounded-lg font-black text-xl tracking-wide uppercase select-none
        ${shaking ? 'animate-shake' : ''}
        ${jumping ? 'animate-jump' : ''}
        ${merging ? 'animate-merge' : ''}
      `}
      style={{
        backgroundColor: selected ? 'var(--tile-selected)' : 'var(--tile-bg)',
        color: selected ? 'var(--tile-selected-text)' : 'var(--tile-text)',
        fontFamily: 'var(--font-franklin)',
        animationDelay: jumping ? `${jumpDelay}ms` : '0ms',
      }}
    >
      <span className="text-center leading-tight px-1">{word}</span>
    </button>
  );
}
