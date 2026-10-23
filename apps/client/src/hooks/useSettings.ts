'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateRandomAlias } from '../theme/tokens';
import { setMasterVolume } from '../lib/audio';

const SOUND_STORAGE_KEY = 'inkdrop_sound';
const USERNAME_STORAGE_KEY = 'inkdrop_username';
const VOLUME_STORAGE_KEY = 'inkdrop_volume';
const GLOW_STORAGE_KEY = 'inkdrop_glow';
const LOW_EFFECTS_STORAGE_KEY = 'inkdrop_low_effects';

export interface SettingsState {
  soundEnabled: boolean;
  volume: number; // 0.0 to 1.0 (default 0.6)
  username: string;
  cursorGlowEnabled: boolean;
  lowEffectsMode: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setUsername: (name: string) => void;
  setCursorGlowEnabled: (enabled: boolean) => void;
  setLowEffectsMode: (enabled: boolean) => void;
}

// Global in-memory reactive store to ensure instantaneous 100% synchronization
// across Header, Lobby "Speaking as", Settings modal, and SocketContext.
let globalUsername = '';
let globalSoundEnabled = true;
let globalVolume = 0.6;
let globalCursorGlowEnabled = true;
let globalLowEffectsMode = false;
let isStoreInitialized = false;
const storeListeners = new Set<() => void>();

function syncHtmlClasses(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('low-effects', globalLowEffectsMode);
  }
}

function initStoreIfNeeded(): void {
  if (isStoreInitialized || typeof window === 'undefined') return;

  try {
    const storedSound = localStorage.getItem(SOUND_STORAGE_KEY);
    if (storedSound !== null) {
      globalSoundEnabled = storedSound === 'true';
    }

    const storedGlow = localStorage.getItem(GLOW_STORAGE_KEY);
    if (storedGlow !== null) {
      globalCursorGlowEnabled = storedGlow === 'true';
    }

    const storedLowEffects = localStorage.getItem(LOW_EFFECTS_STORAGE_KEY);
    if (storedLowEffects !== null) {
      globalLowEffectsMode = storedLowEffects === 'true';
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

  syncHtmlClasses();
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
    if (e.key === GLOW_STORAGE_KEY && e.newValue !== null) {
      globalCursorGlowEnabled = e.newValue === 'true';
      changed = true;
    }
    if (e.key === LOW_EFFECTS_STORAGE_KEY && e.newValue !== null) {
      globalLowEffectsMode = e.newValue === 'true';
      syncHtmlClasses();
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

  // Automated frame-rate monitor: Auto-enable Low Effects mode if frame rate drops under ~45fps for 3 seconds
  if (typeof window !== 'undefined' && !globalLowEffectsMode) {
    let lastTime = performance.now();
    let frameCount = 0;
    let under45StartTime: number | null = null;
    let fpsRafId: number | null = null;

    const fpsCheckLoop = (now: number) => {
      frameCount++;
      const delta = now - lastTime;
      if (delta >= 1000) {
        const fps = (frameCount * 1000) / delta;
        frameCount = 0;
        lastTime = now;

        if (fps < 45 && !document.hidden) {
          if (!under45StartTime) {
            under45StartTime = now;
          } else if (now - under45StartTime >= 3000) {
            // Frame rate dropped under ~45fps for 3 consecutive seconds
            globalLowEffectsMode = true;
            syncHtmlClasses();
            try {
              localStorage.setItem(LOW_EFFECTS_STORAGE_KEY, 'true');
            } catch {}
            storeListeners.forEach((fn) => fn());
            return; // stop monitor
          }
        } else {
          under45StartTime = null;
        }
      }
      fpsRafId = requestAnimationFrame(fpsCheckLoop);
    };

    // Delay monitor start by 4s to allow initial page hydration
    setTimeout(() => {
      if (!globalLowEffectsMode) {
        fpsRafId = requestAnimationFrame(fpsCheckLoop);
      }
    }, 4000);
  }
}

export function useSettings(): SettingsState {
  // Start with SSR-safe initial states to prevent React hydration mismatch
  const [soundEnabled, setSoundEnabledLocal] = useState<boolean>(true);
  const [volume, setVolumeLocal] = useState<number>(0.6);
  const [username, setUsernameLocal] = useState<string>('');
  const [cursorGlowEnabled, setCursorGlowEnabledLocal] = useState<boolean>(true);
  const [lowEffectsMode, setLowEffectsModeLocal] = useState<boolean>(false);

  useEffect(() => {
    initStoreIfNeeded();
    setSoundEnabledLocal(globalSoundEnabled);
    setVolumeLocal(globalVolume);
    setUsernameLocal(globalUsername);
    setCursorGlowEnabledLocal(globalCursorGlowEnabled);
    setLowEffectsModeLocal(globalLowEffectsMode);

    const handleUpdate = () => {
      setSoundEnabledLocal(globalSoundEnabled);
      setVolumeLocal(globalVolume);
      setUsernameLocal(globalUsername);
      setCursorGlowEnabledLocal(globalCursorGlowEnabled);
      setLowEffectsModeLocal(globalLowEffectsMode);
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

  const setCursorGlowEnabled = useCallback((enabled: boolean) => {
    globalCursorGlowEnabled = enabled;
    try {
      localStorage.setItem(GLOW_STORAGE_KEY, String(enabled));
    } catch {
      // Storage restricted mode tolerance
    }
    storeListeners.forEach((fn) => fn());
  }, []);

  const setLowEffectsMode = useCallback((enabled: boolean) => {
    globalLowEffectsMode = enabled;
    syncHtmlClasses();
    try {
      localStorage.setItem(LOW_EFFECTS_STORAGE_KEY, String(enabled));
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
    cursorGlowEnabled,
    lowEffectsMode,
    setSoundEnabled,
    setVolume,
    setUsername,
    setCursorGlowEnabled,
    setLowEffectsMode,
  };
}
