'use client';

import { useTheme } from '@/components/ThemeProvider';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-fade-in"
        style={{ backgroundColor: 'var(--modal-bg)', color: 'var(--text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black tracking-tight">Settings</h2>
          <button onClick={onClose} className="text-2xl leading-none opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Dark Mode */}
        <SettingsRow
          label="Dark Mode"
          description=""
          active={theme === 'dark'}
          onToggle={() => setTheme(theme === 'dark' ? 'system' : 'dark')}
        />

        <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />

        {/* Light Mode */}
        <SettingsRow
          label="Light Mode"
          description=""
          active={theme === 'light'}
          onToggle={() => setTheme(theme === 'light' ? 'system' : 'light')}
        />

        <div className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Connections Clone • <a href="https://wyattprice.dev">Wyatt Price</a>
        </div>
      </div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}

function SettingsRow({ label, description, active, onToggle }: SettingsRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="font-bold text-base">{label}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={active}
        className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all"
        style={{
          borderColor: 'var(--outline-button-border)',
          backgroundColor: active ? 'var(--button-bg)' : 'transparent',
        }}
      >
        {active && (
          <span className="block w-full h-full rounded-full" style={{ backgroundColor: 'var(--button-bg)' }} />
        )}
      </button>
    </div>
  );
}
