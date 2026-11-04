# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.24"]
# ///
"""Synthesizes music.wav for the beat-sync example: 8 bars at 120 BPM in 4/4.

Bars 1–4: kick, hats and bass over Am–F–C–G. Bars 5–8 move to F–G–Em–Am and add snare,
chords and a lead, so the analysis finds a section start at bar 5. Generated from scratch; the audio is CC0 like this script.

  uv run music.py && ffmpeg -i music.wav -ac 1 -b:a 64k music.mp3
"""

import wave

import numpy as np

SR = 22050
BPM = 120
BEAT = 60 / BPM
START = 0.25  # first downbeat
BARS = 8
N = int(SR * (START + BARS * 4 * BEAT + 1.0))
out = np.zeros(N)
rng = np.random.default_rng(7)


def add(sig, t):
    i = int(t * SR)
    out[i : i + len(sig)] += sig[: max(0, N - i)]


def env(n, attack=0.002, decay=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t / 0.03)
    return 0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.12)


def snare():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n) * env(n, 0.001, 0.06)
    tone = np.sin(2 * np.pi * 190 * t) * env(n, 0.001, 0.05)
    return 0.35 * noise + 0.3 * tone


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))  # crude high-pass
    return 0.12 * x * env(n, 0.001, 0.06 if open_ else 0.015)


def tone(freq, dur, amp, decay, harmonics=(1, 0.5, 0.25)):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
    return amp * s * env(n, 0.005, decay)


def hz(note):  # MIDI note number
    return 440 * 2 ** ((note - 69) / 12)


# One chord per bar: Am–F–C–G, then F–G–Em–Am.
roots = [45, 41, 48, 43, 41, 43, 40, 45]
chords = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62], [55, 59, 64], [57, 60, 64]]
lead = [72, 74, 76, None, 74, 76, 79, None, 79, 76, 74, None, 76, 72, 69, None]

for bar in range(BARS):
    t0 = START + bar * 4 * BEAT
    full = bar >= 4
    for b in range(4):
        tb = t0 + b * BEAT
        add(kick(), tb)
        if full and b in (1, 3):
            add(snare(), tb)
        add(hat(), tb + BEAT / 2)
        if full:
            add(hat(), tb)
    r = roots[bar]
    for b8 in range(8):
        add(tone(hz(r - 12 if b8 % 2 else r), BEAT / 2, 0.25, 0.12, (1, 0.3)), t0 + b8 * BEAT / 2)
    if full:
        for n in chords[bar]:
            for b in (0.5, 1.5, 2.5, 3.5):  # offbeat stabs
                add(tone(hz(n), 0.2, 0.06, 0.08), t0 + b * BEAT)
        for i in range(4):
            note = lead[(bar % 4) * 4 + i]
            if note:
                add(tone(hz(note), BEAT * 0.9, 0.08, 0.25, (1, 0.2, 0.1)), t0 + i * BEAT)

out /= np.abs(out).max() * 1.05
with wave.open("music.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype("<i2").tobytes())
