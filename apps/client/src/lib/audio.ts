/**
 * Ephemeral Web Audio API Synthesizer
 * Produces crisp, organic water-droplet / pop sound cues and message feedback without loading audio files.
 * Fully SSR-safe with zero import-time side effects.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

let currentVolume = 0.6; // Default 60%
let lastIncomingChimeTime = 0;
let lastSendChimeTime = 0;
let lastErrorChimeTime = 0;
let lastSystemChimeTime = 0;

const INCOMING_THROTTLE_MS = 180;
const SEND_THROTTLE_MS = 80; // Fast typists can hear consecutive sends without clipping
const ERROR_THROTTLE_MS = 100;
const SYSTEM_THROTTLE_MS = 200;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();

      // Master Compressor to prevent distortion or clipping when multiple cues overlap
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
      compressor.knee.setValueAtTime(12, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.12, audioCtx.currentTime);
      compressor.connect(audioCtx.destination);

      // Master Gain Node for volume control
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
      masterGain.connect(compressor);
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function setMasterVolume(volume: number): void {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (audioCtx && masterGain) {
    try {
      masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.01);
    } catch {
      masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
    }
  }
}

export function getMasterVolume(): number {
  return currentVolume;
}

/**
 * Message Sent Sound: Tiny, soft, quick "whoosh-tick"
 * Sine tone gliding from ~520Hz up to ~880Hz over ~90ms, with subtle 2nd harmonic for paper texture.
 */
export function playSendSound(soundEnabled = true): void {
  if (!soundEnabled) return;

  const now = Date.now();
  if (now - lastSendChimeTime < SEND_THROTTLE_MS) return;
  lastSendChimeTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    const startTime = ctx.currentTime;
    const duration = 0.14; // 140ms

    // Primary fundamental: 520Hz gliding to 880Hz
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520, startTime);
    osc1.frequency.exponentialRampToValueAtTime(880, startTime + 0.09);

    // Subtle 2nd harmonic: 1040Hz gliding to 1760Hz (15% gain for paper-airy texture)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1040, startTime);
    osc2.frequency.exponentialRampToValueAtTime(1760, startTime + 0.09);

    const cueGain = ctx.createGain();
    // Fast attack (5ms), exponential decay to silence by 140ms, peak gain 0.05
    cueGain.gain.setValueAtTime(0.001, startTime);
    cueGain.gain.linearRampToValueAtTime(0.05, startTime + 0.005);
    cueGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.15, startTime);

    osc1.connect(cueGain);
    osc2.connect(harmonicGain);
    harmonicGain.connect(cueGain);
    cueGain.connect(masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  } catch {
    // Audio context error tolerance
  }
}

/**
 * Message Error / Blocked Sound: Short, low, dull two-step tone (~300Hz to 220Hz, ~120ms, gain ~0.04)
 * Used when a message is blocked (429 rate limit, image too large, or server error).
 */
export function playErrorSound(soundEnabled = true): void {
  if (!soundEnabled) return;

  const now = Date.now();
  if (now - lastErrorChimeTime < ERROR_THROTTLE_MS) return;
  lastErrorChimeTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    const startTime = ctx.currentTime;
    const duration = 0.12;

    const osc = ctx.createOscillator();
    osc.type = 'triangle'; // Softer, duller tone than sine/square

    // Low two-step drop: 300Hz -> 220Hz
    osc.frequency.setValueAtTime(300, startTime);
    osc.frequency.setValueAtTime(300, startTime + 0.04);
    osc.frequency.exponentialRampToValueAtTime(220, startTime + duration);

    const cueGain = ctx.createGain();
    cueGain.gain.setValueAtTime(0.001, startTime);
    cueGain.gain.linearRampToValueAtTime(0.04, startTime + 0.008);
    cueGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(cueGain);
    cueGain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // Audio context error tolerance
  }
}

/**
 * Message Arrival Chime: ~800Hz sine pop with exponential decay (120ms)
 */
export function playMessageChime(soundEnabled = true): void {
  if (!soundEnabled) return;

  const now = Date.now();
  if (now - lastIncomingChimeTime < INCOMING_THROTTLE_MS) return;
  lastIncomingChimeTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    const osc = ctx.createOscillator();
    const cueGain = ctx.createGain();

    osc.type = 'sine';
    const startTime = ctx.currentTime;
    const duration = 0.12;

    // Gentle upward water-pop pitch sweep: 600Hz -> 820Hz -> 400Hz
    osc.frequency.setValueAtTime(600, startTime);
    osc.frequency.exponentialRampToValueAtTime(820, startTime + 0.03);
    osc.frequency.exponentialRampToValueAtTime(400, startTime + duration);

    // Fast attack, exponential decay
    cueGain.gain.setValueAtTime(0.001, startTime);
    cueGain.gain.linearRampToValueAtTime(0.10, startTime + 0.015);
    cueGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(cueGain);
    cueGain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // Audio context error tolerance
  }
}

/**
 * System Event Chime: Dual-tone harmonic swell 400Hz -> 600Hz (280ms)
 */
export function playSystemChime(soundEnabled = true): void {
  if (!soundEnabled) return;

  const now = Date.now();
  if (now - lastSystemChimeTime < SYSTEM_THROTTLE_MS) return;
  lastSystemChimeTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx || !masterGain) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const cueGain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    const startTime = ctx.currentTime;
    const duration = 0.28;

    // Harmonic rise 400Hz to 600Hz
    osc1.frequency.setValueAtTime(400, startTime);
    osc1.frequency.exponentialRampToValueAtTime(600, startTime + duration);

    osc2.frequency.setValueAtTime(800, startTime);
    osc2.frequency.exponentialRampToValueAtTime(1200, startTime + duration);

    cueGain.gain.setValueAtTime(0.001, startTime);
    cueGain.gain.linearRampToValueAtTime(0.07, startTime + 0.04);
    cueGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(cueGain);
    osc2.connect(cueGain);
    cueGain.connect(masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  } catch {
    // Audio context error tolerance
  }
}
