/**
 * Spoken announcements and short signal tones. Everything here is optional: if the browser has
 * no speech or audio support, or the player switches sound off, the game simply stays quiet.
 */
export type Tone = 'horn' | 'alarm' | 'chime' | 'coin' | 'win';

export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private lastSpoken = new Map<string, number>();

  constructor() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.ctx = Ctor ? new Ctor() : null;
    } catch { this.ctx = null; }
    const pick = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      this.voice = voices.find((v) => v.lang.toLowerCase().startsWith('tr')) ?? null;
    };
    pick();
    window.speechSynthesis?.addEventListener?.('voiceschanged', pick);
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) window.speechSynthesis?.cancel();
  }

  /** Reads a short sentence aloud in Turkish. The same sentence is not repeated within a few seconds. */
  speak(text: string): void {
    if (!this.enabled || !window.speechSynthesis) return;
    // Emoji and symbols are for the eye, not the ear.
    const plain = text.replace(/[^\p{L}\p{N}\s.,:;!?'’%-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return;
    const now = performance.now();
    if (now - (this.lastSpoken.get(plain) ?? -1e9) < 8000) return;
    this.lastSpoken.set(plain, now);
    // Do not let a queue of old news build up behind the game.
    if (window.speechSynthesis.pending) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = 'tr-TR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }

  tone(kind: Tone): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes: Record<Tone, [number, number, OscillatorType][]> = {
      horn: [[196, 0.5, 'sawtooth'], [147, 0.9, 'sawtooth']],
      alarm: [[880, 0.12, 'square'], [660, 0.12, 'square'], [880, 0.12, 'square'], [660, 0.12, 'square']],
      chime: [[660, 0.15, 'sine'], [880, 0.25, 'sine']],
      coin: [[1047, 0.07, 'triangle'], [1568, 0.14, 'triangle']],
      win: [[523, 0.15, 'triangle'], [659, 0.15, 'triangle'], [784, 0.15, 'triangle'], [1047, 0.4, 'triangle']],
    };
    let at = ctx.currentTime;
    for (const [freq, len, type] of notes[kind]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + len + 0.02);
      at += len;
    }
  }
}
