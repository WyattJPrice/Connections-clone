'use client';

import { Category } from '@/lib/types';

const COLOR_MAP: Record<string, string> = {
  yellow: '#f9df6d',
  blue: '#b0c4ef',
  green: '#a0c35a',
  purple: '#ba81c5',
};

interface CategoryRowProps {
  category: Category;
  animate: boolean;
}

export function CategoryRow({ category, animate }: CategoryRowProps) {
  return (
    <div
      className={`w-full rounded-lg flex flex-col items-center justify-center py-4 px-3 ${animate ? 'animate-pop-in' : ''}`}
      style={{
        backgroundColor: COLOR_MAP[category.color] ?? '#ccc',
        minHeight: '80px',
      }}
    >
      <p className="font-bold text-base tracking-widest uppercase text-center text-black/90">
        {category.name}
      </p>
      <p className="font-normal text-sm text-black/80 text-center mt-0.5">
        {category.words.join(', ')}
      </p>
    </div>
  );
}
