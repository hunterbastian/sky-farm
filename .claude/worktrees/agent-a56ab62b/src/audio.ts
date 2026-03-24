// ── Sound Engine (procedural Web Audio) ──────────────────
let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "square", volume = 0.08): void {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.03): void {
  const ctx = ensureAudio();
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(gain).connect(ctx.destination);
  src.start();
}

// Named sound effects
export function sfxTill(): void { playTone(180, 0.08, "square", 0.06); setTimeout(() => playNoise(0.06, 0.04), 40); }
export function sfxPlant(): void { playTone(440, 0.06, "sine", 0.05); playTone(550, 0.08, "sine", 0.04); }
export function sfxWater(): void { playNoise(0.12, 0.05); playTone(800, 0.05, "sine", 0.02); }
export function sfxChop(): void { playTone(120, 0.06, "square", 0.08); setTimeout(() => playNoise(0.08, 0.06), 30); }
export function sfxTreeFall(): void { playTone(80, 0.2, "sawtooth", 0.06); setTimeout(() => playNoise(0.15, 0.05), 100); }
export function sfxHarvest(): void {
  playTone(523, 0.08, "square", 0.05);
  setTimeout(() => playTone(659, 0.08, "square", 0.05), 80);
  setTimeout(() => playTone(784, 0.1, "square", 0.04), 160);
}
export function sfxCoin(): void { playTone(880, 0.06, "square", 0.04); setTimeout(() => playTone(1320, 0.1, "square", 0.03), 60); }
export function sfxEgg(): void { playTone(600, 0.05, "sine", 0.04); setTimeout(() => playTone(800, 0.06, "sine", 0.03), 50); }
export function sfxSelect(): void { playTone(660, 0.04, "square", 0.03); }
export function sfxError(): void { playTone(200, 0.1, "square", 0.04); }
