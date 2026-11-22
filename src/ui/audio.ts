import { resourceUrl } from "./resource.ts";

const STORAGE_KEY = "earth:audio:v1";
const MUSIC_KEY = "earth:music:v1";
const SIGNALS = ["choice", "year", "inherit"] as const;

export type SignalName = typeof SIGNALS[number];

export class AudioPlayer {
  private enabled = false;
  private volume = 0.5;
  private current: HTMLAudioElement | null = null;
  private musicEnabled = false;
  private musicVolume = 0.3;
  private music: HTMLAudioElement | null = null;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { enabled?: unknown; volume?: unknown } | null;
      if (saved) {
        this.enabled = saved.enabled === true;
        if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) this.volume = Math.min(1, Math.max(0, saved.volume));
      }
    } catch {
    }
    try {
      const music = JSON.parse(localStorage.getItem(MUSIC_KEY) ?? "null") as { enabled?: unknown; volume?: unknown } | null;
      if (music) {
        this.musicEnabled = music.enabled === true;
        if (typeof music.volume === "number" && Number.isFinite(music.volume)) this.musicVolume = Math.min(1, Math.max(0, music.volume));
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

  get musicIsEnabled(): boolean {
    return this.musicEnabled;
  }

  get musicVolumePercent(): number {
    return Math.round(this.musicVolume * 100);
  }

  setMusicEnabled(value: boolean): void {
    this.musicEnabled = value;
    this.persistMusic();
    if (value) this.ensureMusic();
    else this.stopMusic();
  }

  setMusicVolume(value: number): void {
    this.musicVolume = Math.min(1, Math.max(0, value));
    this.persistMusic();
    if (this.music) this.music.volume = this.musicVolume ** 2;
    if (this.musicVolume === 0) this.music?.pause();
    else if (this.musicEnabled) this.ensureMusic();
  }

  ensureMusic(): boolean {
    if (!this.musicEnabled || this.musicVolume === 0) return false;
    try {
      if (!this.music) {
        this.music = new Audio(resourceUrl("audio/music.ogg"));
        this.music.loop = true;
      }
      this.music.volume = this.musicVolume ** 2;
      if (this.music.paused) void this.music.play().catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  private stopMusic(): void {
    if (!this.music) return;
    this.music.pause();
    this.music.currentTime = 0;
    this.music = null;
  }

  private persistMusic(): void {
    try {
      localStorage.setItem(MUSIC_KEY, JSON.stringify({ enabled: this.musicEnabled, volume: this.musicVolume }));
    } catch {
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: this.enabled, volume: this.volume }));
    } catch {
    }
  }
}
