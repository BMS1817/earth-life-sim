import math
import random
import shutil
import subprocess
import wave
from pathlib import Path

RATE = 22050
DURATION = 72.0
CHORD_SECONDS = 6.0
COUNT = round(RATE * DURATION)
TAU = math.tau
CHORDS = [
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [43, 47, 50, 53],
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [43, 47, 50, 55],
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [43, 47, 50, 55],
]
MELODY = [72, 76, 79, 76, 74, 72, 69, 67, 69, 72, 76, 79, 81, 79, 76, 74, 72, 69]


def frequency(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def main():
    left = [0.0] * COUNT
    right = [0.0] * COUNT
    rng = random.Random("earth-ambient-chiptune-v1")
    for chord_index, chord in enumerate(CHORDS):
        start = round(chord_index * CHORD_SECONDS * RATE)
        end = round((chord_index + 1) * CHORD_SECONDS * RATE)
        for note_index, note in enumerate(chord):
            freq = frequency(note)
            pan = 0.35 + note_index * 0.1
            for index in range(start, end):
                local = (index - start) / RATE
                progress = local / CHORD_SECONDS
                envelope = min(1.0, progress * 5.0, (1.0 - progress) * 5.0)
                pad = math.sin(TAU * freq * local) + 0.24 * math.sin(TAU * freq * 2 * local)
                tremolo = 1.0 + 0.035 * math.sin(TAU * 0.17 * local + note_index)
                value = pad * envelope * tremolo * 0.12
                left[index] += value * (1.0 - pan)
                right[index] += value * pan
    for note_index, note in enumerate(MELODY):
        start_time = 1.5 + note_index * 4.0
        if start_time >= DURATION:
            break
        start = round(start_time * RATE)
        length = round(1.35 * RATE)
        freq = frequency(note)
        pan = 0.3 if note_index % 2 == 0 else 0.7
        for offset in range(length):
            index = start + offset
            if index >= COUNT:
                break
            t = offset / RATE
            envelope = min(1.0, t / 0.025) * max(0.0, 1.0 - t / 1.35) ** 2
            value = (math.sin(TAU * freq * t) + 0.18 * math.sin(TAU * freq * 3 * t)) * envelope * 0.14
            left[index] += value * (1.0 - pan)
            right[index] += value * pan
    peak = max(max(abs(value) for value in left), max(abs(value) for value in right))
    scale = 0.3 / max(peak, 0.0001)
    fade = round(0.08 * RATE)
    for index in range(fade):
        factor = index / fade
        end_index = COUNT - fade + index
        left[index] *= factor
        right[index] *= factor
        left[end_index] *= 1.0 - index / fade
        right[end_index] *= 1.0 - index / fade
    output = Path(".tools/music/earth-ambient.wav")
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        frames = bytearray()
        for l, r in zip(left, right):
            frames.extend(int(max(-1.0, min(1.0, l * scale)) * 32767).to_bytes(2, "little", signed=True))
            frames.extend(int(max(-1.0, min(1.0, r * scale)) * 32767).to_bytes(2, "little", signed=True))
        wav.writeframes(frames)
    ffmpeg = shutil.which("ffmpeg") or "D:/Clode/Tools/ffmpeg/bin/ffmpeg.exe"
    encoded = Path("public/audio/music.ogg")
    encoded.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(output), "-c:a", "libvorbis", "-q:a", "4", str(encoded)], check=True)
    print(f"{encoded}: {DURATION:.0f}s stereo, {encoded.stat().st_size} bytes")


if __name__ == "__main__":
    main()
