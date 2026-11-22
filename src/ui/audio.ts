import { resourceUrl } from "./resource.ts";

const STORAGE_KEY = "earth:audio:v1";
const SIGNALS = ["choice", "year", "inherit"] as const;

export type SignalName = typeof SIGNALS[number];

export class AudioPlayer {
  private enabled = false;
  private volume = 0.5;
  private current: HTMLAudioElement | null = null;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { enabled?: unknown; volume?: unknown } | null;
      if (saved) {
        this.enabled = saved.enabled === true;
        if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) this.volume = Math.min(1, Math.max(0, saved.volume));
      }
    } catch {
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get volumePercent(): number {
    return Math.round(this.volume * 100);
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.persist();
    if (!value) this.stop();
  }

  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    this.persist();
    if (this.current) this.current.volume = this.volume ** 2;
    if (this.volume === 0) this.stop();
  }

  play(name: SignalName): boolean {
    if (!this.enabled || this.volume === 0 || !SIGNALS.includes(name)) return false;
    this.stop();
    try {
      const audio = new Audio(resourceUrl(`audio/${name}.wav`));
      audio.volume = this.volume ** 2;
      this.current = audio;
      const clear = () => {
        if (this.current === audio) this.current = null;
      };
      audio.addEventListener("ended", clear, { once: true });
      void audio.play().catch(clear);
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    if (!this.current) return;
    this.current.pause();
    this.current.currentTime = 0;
    this.current = null;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: this.enabled, volume: this.volume }));
    } catch {
    }
  }
}
