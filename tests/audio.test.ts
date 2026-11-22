import { afterEach, describe, expect, it } from "vitest";
import { AudioPlayer } from "../src/ui/audio.ts";

class FakeAudio {
  static instances: FakeAudio[] = [];
  volume = 1;
  currentTime = 0;
  paused = true;
  playCalls = 0;
  ended: (() => void) | null = null;
  readonly src: string;

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls++;
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  addEventListener(name: string, callback: () => void): void {
    if (name === "ended") this.ended = callback;
  }
}

const originalAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function install(): Map<string, string> {
  const data = new Map<string, string>();
  FakeAudio.instances = [];
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudio });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
  return data;
}

afterEach(() => {
  if (originalAudio) Object.defineProperty(globalThis, "Audio", originalAudio);
  else delete (globalThis as { Audio?: unknown }).Audio;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete (globalThis as { window?: unknown }).window;
});

describe("опциональные SFX", () => {
  it("по умолчанию выключены и не создают Audio", () => {
    install();
    const player = new AudioPlayer();
    expect(player.isEnabled).toBe(false);
    expect(player.play("choice")).toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("сохраняет opt-in и квадратичную громкость, останавливает предыдущий сигнал", () => {
    const storage = install();
    const player = new AudioPlayer();
    player.setEnabled(true);
    player.setVolume(0.5);
    expect(player.play("choice")).toBe(true);
    const first = FakeAudio.instances[0];
    expect(first.src).toBe("audio/choice.wav");
    expect(first.volume).toBe(0.25);
    expect(player.play("year")).toBe(true);
    const second = FakeAudio.instances[1];
    expect(first.paused).toBe(true);
    expect(second.src).toBe("audio/year.wav");
    expect(JSON.parse(storage.get("earth:audio:v1")!)).toEqual({ enabled: true, volume: 0.5 });
    const restored = new AudioPlayer();
    expect(restored.isEnabled).toBe(true);
    expect(restored.volumePercent).toBe(50);
  });

  it("выключение и нулевая громкость останавливают звук и запрещают новые сигналы", () => {
    install();
    const player = new AudioPlayer();
    player.setEnabled(true);
    player.play("choice");
    const first = FakeAudio.instances[0];
    player.setEnabled(false);
    expect(first.paused).toBe(true);
    expect(player.play("inherit")).toBe(false);
    player.setEnabled(true);
    player.setVolume(0);
    expect(player.play("choice")).toBe(false);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it("повреждённые настройки безопасно возвращаются к выключенному звуку", () => {
    const storage = install();
    storage.set("earth:audio:v1", "{broken");
    const player = new AudioPlayer();
    expect(player.isEnabled).toBe(false);
    expect(player.volumePercent).toBe(50);
  });
});
