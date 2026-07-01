"use client";

// Sound alert utility using the Web Audio API (no external audio files).
// Generates pleasant two-tone beeps when signals trigger or arm.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // resume if suspended (browsers require a user gesture)
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(
  freq: number,
  start: number,
  duration: number,
  volume = 0.25,
  type: OscillatorType = "sine"
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  osc.connect(gain);
  gain.connect(c.destination);
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    c.currentTime + start + duration
  );
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.05);
}

// Signal triggered (price crossed a level) — urgent two-tone rising
export function playTriggerSound() {
  tone(880, 0, 0.18, 0.3, "square");
  tone(1320, 0.16, 0.28, 0.28, "square");
}

// Signal armed (price near a level) — soft single chime
export function playArmSound() {
  tone(660, 0, 0.22, 0.18, "sine");
}

// Confirm button click — short tick
export function playClickSound() {
  tone(1200, 0, 0.06, 0.12, "triangle");
}

// Unlock audio context after a user gesture (required by browsers)
export function unlockAudio() {
  getCtx();
}
