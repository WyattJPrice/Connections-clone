'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { StatsModal } from './StatsModal';
import { SettingsModal } from './SettingsModal';
import { LeaderboardModal } from './LeaderboardModal';

interface ModalsContextValue {
  openStats: () => void;
  openSettings: () => void;
  openLeaderboard: () => void;
}

const ModalsContext = createContext<ModalsContextValue | null>(null);

export function useModals(): ModalsContextValue {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error('useModals must be used inside <ModalsProvider>');
  return ctx;
}

export function ModalsProvider({ children }: { children: ReactNode }) {
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const openStats = useCallback(() => setShowStats(true), []);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const openLeaderboard = useCallback(() => setShowLeaderboard(true), []);

  return (
    <ModalsContext.Provider value={{ openStats, openSettings, openLeaderboard }}>
      {children}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
    </ModalsContext.Provider>
  );
}
