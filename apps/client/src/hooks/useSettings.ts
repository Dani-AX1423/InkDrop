'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateRandomAlias } from '../theme/tokens';
import { setMasterVolume } from '../lib/audio';

const SOUND_STORAGE_KEY = 'inkdrop_sound';
const USERNAME_STORAGE_KEY = 'inkdrop_username';
const VOLUME_STORAGE_KEY = 'inkdrop_volume';

export interface SettingsState {
  soundEnabled: boolean;
  volume: number; // 0.0 to 1.0 (default 0.6)
  username: string;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setUsername: (name: string) => void;
}

// Global in-memory reactive store to ensure instantaneous 100% synchronization
// across Header, Lobby "Speaking as", Settings modal, and SocketContext.
let globalUsername = '';
let globalSoundEnabled = true;
let globalVolume = 0.6;
let isStoreInitialized = false;
const storeListeners = new Set<() => void>();

function initStoreIfNeeded(): void {
  if (isStoreInitialized || typeof window === 'undefined') return;

  try {
    const storedSound = localStorage.getItem(SOUND_STORAGE_KEY);
    if (storedSound !== null) {
      globalSoundEnabled = storedSound === 'true';
    }

    const storedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (storedVolume !== null) {
      const parsed = parseFloat(storedVolume);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        globalVolume = parsed;
      }
    }
    setMasterVolume(globalVolume);

    const storedUser = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (storedUser && storedUser.trim()) {
      globalUsername = storedUser.trim();
    } else {
      globalUsername = generateRandomAlias();
      localStorage.setItem(USERNAME_STORAGE_KEY, globalUsername);
    }
  } catch {
    globalUsername = globalUsername || generateRandomAlias();
  }

  isStoreInitialized = true;
}

export function getStoredUsername(): string {
  initStoreIfNeeded();
  return globalUsername;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    let changed = false;
    if (e.key === SOUND_STORAGE_KEY && e.newValue !== null) {
      globalSoundEnabled = e.newValue === 'true';
      changed = true;
    }
    if (e.key === VOLUME_STORAGE_KEY && e.newValue !== null) {
      const parsed = parseFloat(e.newValue);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        globalVolume = parsed;
        setMasterVolume(parsed);
        changed = true;
      }
    }
    if (e.key === USERNAME_STORAGE_KEY && e.newValue) {
      globalUsername = e.newValue.trim();
      changed = true;
    }
    if (changed) {
      storeListeners.forEach((fn) => fn());
    }
  });
}

export function useSettings(): SettingsState {
  // Start with SSR-safe initial states to prevent React hydration mismatch
  const [soundEnabled, setSoundEnabledLocal] = useState<boolean>(true);
  const [volume, setVolumeLocal] = useState<number>(0.6);
  const [username, setUsernameLocal] = useState<string>('');

  useEffect(() => {
    initStoreIfNeeded();
    setSoundEnabledLocal(globalSoundEnabled);
    setVolumeLocal(globalVolume);
    setUsernameLocal(globalUsername);

    const handleUpdate = () => {
      setSoundEnabledLocal(globalSoundEnabled);
      setVolumeLocal(globalVolume);
      setUsernameLocal(globalUsername);
    };

    storeListeners.add(handleUpdate);
    return () => {
      storeListeners.delete(handleUpdate);
    };
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    globalSoundEnabled = enabled;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
    } catch {
      // Storage restricted mode tolerance
    }
    storeListeners.forEach((fn) => fn());
  }, []);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    globalVolume = clamped;
    setMasterVolume(clamped);
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, clamped.toString());
    } catch {
      // Storage restricted mode tolerance
    }
    storeListeners.forEach((fn) => fn());
  }, []);

  const setUsername = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    globalUsername = trimmed;
    try {
      localStorage.setItem(USERNAME_STORAGE_KEY, trimmed);
    } catch {
      // Storage restricted mode tolerance
    }
    storeListeners.forEach((fn) => fn());
  }, []);

  return {
    soundEnabled,
    volume,
    username,
    setSoundEnabled,
    setVolume,
    setUsername,
  };
}
