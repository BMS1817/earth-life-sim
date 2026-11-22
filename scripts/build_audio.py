import math
import random
import wave
from pathlib import Path

RATE = 22050
PEAK = 0.35


def tone(freq, duration, start=0.0):
    count = round(duration * RATE)
    start_index = round(start * RATE)
    for i in range(count):
        t = i / RATE
        attack = min(1.0, t / 0.008)
        release = min(1.0, (duration - t) / 0.045)
        envelope = attack * max(0.0, release) * math.exp(-2.8 * t / duration)
        yield start_index + i, math.sin(2 * math.pi * freq * t) * envelope


def write_signal(name, duration, parts, noise=0.0):
    samples = [0.0] * round(duration * RATE)
    for start, freq, length in parts:
        for index, value in tone(freq, length, start):
            if index < len(samples):
                samples[index] += value
    if noise:
        rng = random.Random(name)
        for i in range(len(samples)):
            t = i / RATE
            envelope = min(1.0, t / 0.003) * max(0.0, (duration - t) / duration)
            samples[i] += (rng.random() * 2 - 1) * noise * envelope
    scale = PEAK / max(0.0001, max(abs(value) for value in samples))
    path = Path("public/audio") / f"{name}.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b"".join(int(max(-1, min(1, value * scale)) * 32767).to_bytes(2, "little", signed=True) for value in samples))
    print(f"{path}: {duration:.2f}s, {path.stat().st_size} bytes")


write_signal("choice", 0.18, [(0.0, 523.25, 0.09), (0.075, 659.25, 0.105)])
write_signal("year", 0.12, [(0.0, 392.0, 0.12)], noise=0.18)
write_signal("inherit", 0.48, [(0.0, 523.25, 0.16), (0.15, 659.25, 0.16), (0.30, 783.99, 0.18)])
