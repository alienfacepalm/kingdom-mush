import type { DamageType } from "../content/types";

const MUTE_KEY = "capkeep-mute";

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  constructor() {
    if (typeof localStorage !== "undefined") this.muted = localStorage.getItem(MUTE_KEY) === "1";
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (typeof localStorage !== "undefined") localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    return this.muted;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  ui(): void {
    this.tone(620, 0.04, "square", 0.03);
  }

  shot(kind: DamageType): void {
    if (kind === "magic") this.tone(420, 0.08, "sine", 0.04);
    else if (kind === "explosive") this.tone(140, 0.12, "sawtooth", 0.04);
    else if (kind === "electric") this.tone(880, 0.05, "square", 0.03);
    else this.tone(760, 0.03, "square", 0.02);
  }

  leak(): void {
    this.tone(110, 0.18, "sawtooth", 0.05);
  }

  win(): void {
    this.tone(520, 0.1, "triangle", 0.04);
    window.setTimeout(() => this.tone(680, 0.14, "triangle", 0.04), 90);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }
}

export const sfx = new Sfx();
