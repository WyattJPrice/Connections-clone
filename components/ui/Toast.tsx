'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  onDone: () => void;
  duration?: number;
}

export function Toast({ message, onDone, duration = 1800 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full font-bold text-sm shadow-lg transition-opacity duration-300"
      style={{
        backgroundColor: 'var(--text)',
        color: 'var(--bg)',
        opacity: visible ? 1 : 0,
      }}
    >
      {message}
    </div>
  );
}
