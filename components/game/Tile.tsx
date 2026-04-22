'use client';

interface TileProps {
  word: string;
  selected: boolean;
  solved: boolean;
  shaking: boolean;
  jumping: boolean;
  jumpDelay: number;
  onClick: () => void;
}

export function Tile({ word, selected, solved, shaking, jumping, jumpDelay, onClick }: TileProps) {
  if (solved) return null;

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center w-full aspect-square rounded-lg
        font-black text-sm tracking-widest uppercase select-none
        transition-transform duration-100 active:scale-95
        ${shaking ? 'animate-shake' : ''}
        ${jumping ? 'animate-jump' : ''}
      `}
      style={{
        backgroundColor: selected ? 'var(--tile-selected)' : 'var(--tile-bg)',
        color: selected ? 'var(--tile-selected-text)' : 'var(--tile-text)',
        animationDelay: jumping ? `${jumpDelay}ms` : '0ms',
        minHeight: '72px',
      }}
    >
      <span className="text-center leading-tight px-1 text-xs sm:text-sm">{word}</span>
    </button>
  );
}
