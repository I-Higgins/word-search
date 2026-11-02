// Soft sounds, synthesised with Web Audio (no audio files to download).
// Off by default; turned on in Settings.

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, dur, gain = 0.12) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function playFound() {
  try {
    tone(659.25, 0, 0.35); // E5
    tone(987.77, 0.09, 0.45, 0.09); // B5
  } catch { /* ignore */ }
}

export function playComplete() {
  try {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.6, 0.1));
  } catch { /* ignore */ }
}

/** Call from a user gesture so iOS allows audio later. */
export function unlockAudio() {
  try { audio(); } catch { /* ignore */ }
}
