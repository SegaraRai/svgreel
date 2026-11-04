# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#   "beat-this==1.1.0",
#   "librosa>=0.10",
#   "matplotlib>=3.8",
#   "numpy>=1.24",
#   "soundfile>=0.12",
# ]
# ///

"""
Beat analysis for svgreel compositions. Copy this file into your project (tools/beatmap.py)
and run it with uv, which installs the dependencies:

  uv run tools/beatmap.py analyze song.mp3 -o song.analysis.json --png song.png
  uv run tools/beatmap.py export song.analysis.json -o beats.json
      [--every N --bar M --phase P | --pattern "3+2,3+3" --phase P] [--from S --to S]

`analyze` runs Beat This!, fits tempo segments (constant tempo, step changes, or free time),
reports meter, downbeat phase, an accent cycle (for additive meters), rhythm confidence per
window, sections and onsets, plus a suggested pulse level. `export` turns it into the BeatMap a
composition imports. All times are seconds in the audio file.

This file is yours: change it freely. svgreel ships the original in node_modules/svgreel/tools/;
after updating svgreel, diff the two and take what you want (svgreel's docs/tools.md).
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import librosa
import numpy as np

SR = 22050
HOP = 256


# --------------------------------------------------------------------------- audio features


class Audio:
    def __init__(self, path: Path):
        self.path = path
        self.y, _ = librosa.load(str(path), sr=SR, mono=True)
        self.duration = len(self.y) / SR
        S = np.abs(librosa.stft(self.y, n_fft=2048, hop_length=HOP))
        freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
        logS = np.log1p(S)
        self.flux_low = np.concatenate([[0], np.maximum(0, np.diff(logS[freqs < 150], axis=1)).sum(0)])
        self.flux_all = np.concatenate([[0], np.maximum(0, np.diff(logS, axis=1)).sum(0)])
        self.t = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=HOP)
        self.chroma = librosa.feature.chroma_stft(S=S**2, sr=SR)
        self.rms = librosa.feature.rms(S=S)[0]
        self.onset_env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S), sr=SR)

    def peak(self, sig, at, w=0.04):
        m = (self.t >= at - w) & (self.t <= at + w)
        return float(sig[m].max()) if m.any() else 0.0

    def accents(self, grid: np.ndarray) -> dict[str, np.ndarray]:
        """Per grid beat: bass attack, overall attack and harmonic change, z-scored."""
        bass = np.array([self.peak(self.flux_low, g) for g in grid])
        onset = np.array([self.peak(self.flux_all, g) for g in grid])
        harm = np.zeros(len(grid))
        for i, g in enumerate(grid):
            p = (grid[i + 1] - g) if i + 1 < len(grid) else (g - grid[i - 1] if i else 0.5)
            a = self.chroma[:, (self.t >= g - p) & (self.t < g)]
            b = self.chroma[:, (self.t >= g) & (self.t < g + p)]
            if a.shape[1] and b.shape[1]:
                va, vb = a.mean(1), b.mean(1)
                harm[i] = 1 - va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9)
        z = lambda v: (v - v.mean()) / (v.std() + 1e-9)
        out = {"bass": z(bass), "onset": z(onset), "harm": z(harm)}
        out["total"] = out["bass"] + 0.5 * out["onset"] + 0.5 * out["harm"]
        return out

    def onsets(self, min_strength=0.15):
        fr = librosa.onset.onset_detect(onset_envelope=self.onset_env, sr=SR, hop_length=HOP)
        tt = librosa.frames_to_time(fr, sr=SR, hop_length=HOP)
        s = self.onset_env[fr] / (self.onset_env.max() + 1e-9)
        keep = s >= min_strength
        return tt[keep], s[keep]

    def beat_db(self, times: np.ndarray) -> np.ndarray:
        rt = librosa.frames_to_time(np.arange(len(self.rms)), sr=SR, hop_length=HOP)
        edges = np.append(times, self.duration)
        v = []
        for s, e in zip(edges[:-1], edges[1:]):
            m = (rt >= s) & (rt < e)
            v.append(float(self.rms[m].mean()) if m.any() else 1e-9)
        db = 20 * np.log10(np.asarray(v) + 1e-9)
        return db - db.max()


def run_beat_this(path: Path):
    from beat_this.inference import File2Beats

    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    f2b = File2Beats(checkpoint_path="final0", device=device, dbn=False)
    beats, downbeats = f2b(str(path))
    return np.asarray(beats, float), np.asarray(downbeats, float)


# --------------------------------------------------------------------------- tempo segments


def dominant_period(ibi: np.ndarray) -> float:
    """Most time-covering inter-beat interval; prefers the faster level when the slower is ~2x."""
    ibi = ibi[(ibi > 0.2) & (ibi < 2.0)]
    bins = np.arange(0.2, 2.0, 0.01)
    h, _ = np.histogram(ibi, bins=bins, weights=ibi)
    order = np.argsort(h)[::-1]
    p = bins[order[0]] + 0.005
    for i in order[1:4]:
        q = bins[i] + 0.005
        if abs(q * 2 - p) < 0.03 and h[i] > 0.25 * h[order[0]]:
            p = q
    near = np.abs(ibi - p) < 0.1 * p
    return float(np.mean(ibi[near])) if near.any() else p


def local_periods(beats: np.ndarray, ref: float) -> np.ndarray:
    """Per-interval period at the reference level (x2 intervals from dropped beats divided)."""
    ibi = np.diff(beats)
    steps = np.maximum(1, np.round(ibi / ref))
    return ibi / steps


def fit_constant(beats: np.ndarray, period: float):
    """Least-squares constant grid through raw beats. Returns (offset, period, k, residual, inlier)."""
    kept = [beats[0]]
    for t in beats[1:]:
        if t - kept[-1] >= 0.6 * period:
            kept.append(t)
    x = np.asarray(kept)
    ratio = np.diff(x) / period
    steps = np.maximum(1, np.round(ratio))
    seg = np.concatenate([[0], np.cumsum(np.abs(ratio - steps) > 0.2)])
    k = np.concatenate([[0], np.cumsum(steps)])
    r = np.zeros(len(x))
    b = period
    for it in range(3):
        nseg = seg.max() + 1
        X = np.zeros((len(x), nseg + 1))
        X[:, 0] = k
        X[np.arange(len(x)), seg + 1] = 1
        m = np.ones(len(x), bool) if it == 0 else np.abs(r) < (0.15 if it == 1 else 0.08) * b
        coef, *_ = np.linalg.lstsq(X[m], x[m], rcond=None)
        b = coef[0]
        r = x - X @ coef
    ref = int(np.bincount(seg).argmax())
    a = coef[1 + ref]
    k = k + np.round((coef[1 + seg] - a) / b)
    for tol in (0.15, 0.08):
        r = x - (a + b * k)
        m = np.abs(r) < tol * b
        b, a = np.polyfit(k[m], x[m], 1)
    r = x - (a + b * k)
    m = np.abs(r) < 0.08 * b
    return a, b, x, r, m


# --------------------------------------------------------------------------- tempo segments and meter


def grow_segments(beats: np.ndarray, ref: float, tol_ms=40.0, max_miss=3):
    """Track a constant-tempo grid beat by beat; end the segment after `max_miss` consecutive
    beats that miss the prediction. Missed beats (2-step gaps) and half-time stretches are
    absorbed by rounding the step count; spurious extra beats are skipped."""
    n = len(beats)
    segs = []
    i = 0
    while i < n - 1:
        p = float(np.median(local_periods(beats[i : i + 8], ref))) if n - i > 2 else ref
        ks, ts = [0], [float(beats[i])]
        a, b = float(beats[i]), p
        miss, j, last = 0, i + 1, i
        while j < n:
            t = float(beats[j])
            step = (t - ts[-1]) / b
            if step < 0.6:  # extra beat between grid points
                j += 1
                continue
            k = ks[-1] + max(1, round(step))
            err = t - (a + b * k)
            tol = max(tol_ms / 1000, 0.08 * b) if len(ks) >= 4 else 0.25 * b
            if abs(err) < tol:
                ks.append(k)
                ts.append(t)
                if len(ks) >= 3:
                    b, a = np.polyfit(ks, ts, 1)
                else:
                    b = (ts[-1] - ts[0]) / (ks[-1] - ks[0])
                    a = ts[0]
                miss, last = 0, j
            else:
                miss += 1
                if miss >= max_miss:
                    break
            j += 1
        ks_a, ts_a = np.asarray(ks), np.asarray(ts)
        r = ts_a - (a + b * ks_a)
        segs.append({"lo": i, "hi": last, "start": ts[0], "end": ts[-1], "offset": float(a), "period": float(b),
                     "count": len(ts), "residualMs": float(np.sqrt(np.mean(r**2)) * 1000)})
        i = last + 1
    return segs


def fit_tempo(beats: np.ndarray, duration: float):
    """Tempo segments: constant tempo where the beats allow it (step changes become new segments),
    "free" where they do not (rubato, accelerando, ritardando: the raw beats are kept)."""
    ref = dominant_period(np.diff(beats))
    # Drop spurious extra beats (closer than 0.6 reference periods to the previous kept one).
    kept = [float(beats[0])]
    for t in beats[1:]:
        if t - kept[-1] >= 0.6 * ref:
            kept.append(float(t))
    beats = np.asarray(kept)
    raw_segs = grow_segments(beats, ref)
    segs = []
    for sg in raw_segs:
        sg["free"] = bool(sg["count"] < 8 or sg["residualMs"] > 20)
        if segs and segs[-1]["free"] and sg["free"]:
            segs[-1].update(hi=sg["hi"], end=sg["end"], count=segs[-1]["count"] + sg["count"])
        else:
            segs.append(sg)
    # A short free stretch between two constant segments is usually the transition itself, where
    # the tracker lost a few beats. Give it to the neighbour whose grid explains its beats.
    out = []
    for i, sg in enumerate(segs):
        if sg["free"] and sg["end"] - sg["start"] < 6:
            gap = beats[sg["lo"] : sg["hi"] + 1]
            best = None
            for nb in (segs[i + 1] if i + 1 < len(segs) else None, out[-1] if out else None):
                if nb is None or nb["free"]:
                    continue
                a, b = nb["offset"], nb["period"]
                err = np.abs(gap - (a + b * np.round((gap - a) / b)))
                if np.median(err) < 0.04 and (best is None or np.median(err) < best[0]):
                    best = (float(np.median(err)), nb)
            if best is not None:
                nb = best[1]
                nb["lo"], nb["hi"] = min(nb["lo"], sg["lo"]), max(nb["hi"], sg["hi"])
                nb["start"], nb["end"] = min(nb["start"], sg["start"]), max(nb["end"], sg["end"])
                nb["count"] += sg["count"]
                continue
        out.append(sg)
    segs = out
    # Neighbouring constant segments with the same tempo (split by a pause or glitch) merge.
    merged = []
    for sg in segs:
        pv = merged[-1] if merged else None
        if pv and not pv["free"] and not sg["free"] and abs(pv["period"] / sg["period"] - 1) < 0.003:
            pv.update(hi=sg["hi"], end=sg["end"], count=pv["count"] + sg["count"])
        else:
            merged.append(sg)
    for sg in merged:
        sg["inliers"] = 1.0
        if not sg["free"]:
            a, b, x, r, m = fit_constant(beats[sg["lo"] : sg["hi"] + 1], sg["period"])
            sg.update(offset=float(a), period=float(b), residualMs=float(np.sqrt(np.mean(r[m] ** 2)) * 1000),
                      inliers=float(m.mean()))

    # A constant segment covers [its first beat, next segment's first beat); the first extends
    # back to 0 and the last to the end of the file.
    grid, seg_of = [], []
    for i, sg in enumerate(merged):
        t0 = 0.0 if i == 0 else sg["start"]
        t1 = merged[i + 1]["start"] if i + 1 < len(merged) else duration
        if sg["free"]:
            pts = [float(t) for t in beats[sg["lo"] : sg["hi"] + 1] if t0 - 1e-6 <= t < t1 - 0.3 * ref]
        else:
            a, b = sg["offset"], sg["period"]
            k0 = math.ceil((t0 - a) / b - 0.3)
            pts = [a + b * k for k in range(k0, int((t1 - a) / b) + 2)]
            pts = [t for t in pts if t0 - 0.3 * b <= t < t1 - 0.3 * b and 0 <= t < duration]
        while grid and pts and pts[0] - grid[-1] < 0.5 * min(ref, sg["period"]):
            pts = pts[1:]
        sg["gridStart"] = len(grid)
        grid.extend(pts)
        seg_of.extend([i] * len(pts))
    return np.asarray(grid), merged, ref, np.asarray(seg_of, int)


def meter_from_downbeats(grid: np.ndarray, downbeats: np.ndarray, seg_of: np.ndarray):
    """Global meter, downbeat phase per tempo segment (a tempo change can shift the bar line by a
    grid beat), and the bar position (0 = downbeat) of every grid beat."""
    idx = np.array([int(np.argmin(np.abs(grid - d))) for d in downbeats], int)
    if len(idx):
        idx = idx[np.abs(grid[idx] - downbeats) < 0.06]
    nseg = int(seg_of.max()) + 1 if len(seg_of) else 1
    starts = np.array([int(np.argmax(seg_of == s)) for s in range(nseg)])
    scores = {}
    for m in (2, 3, 4, 6):
        total, phases = 0, []
        for s in range(nseg):
            loc = idx[seg_of[idx] == s] - starts[s] if len(idx) else np.array([], int)
            if len(loc):
                v = np.bincount(loc % m, minlength=m)
                total += int(v.max())
                phases.append(int(v.argmax()))
            else:
                phases.append(phases[-1] if phases else 0)
        scores[m] = (total / max(1, len(idx)), phases)
    meter = 4 if scores[4][0] >= scores[3][0] else 3
    if meter == 3 and scores[6][0] > 0.8:
        meter = 6
    if scores[2][0] - scores[meter][0] > 0.2:
        meter = 2
    phases = scores[meter][1]
    k = np.arange(len(grid))
    barpos = (k - starts[seg_of] - np.asarray(phases)[seg_of]) % meter
    return meter, phases, float(scores[meter][0]), idx, barpos




def accent_cycle(acc: np.ndarray, maxlag=40):
    a = (acc - acc.mean()) / (acc.std() + 1e-9)
    ac = [(lag, float(np.mean(a[:-lag] * a[lag:]))) for lag in range(2, min(maxlag, len(a) // 3) + 1)]
    ac.sort(key=lambda x: -x[1])
    return ac


def fit_groups(profile: np.ndarray, parts=(2, 3), top=5):
    L = len(profile)

    def comps(n):
        if n == 0:
            yield ()
            return
        for p in parts:
            if p <= n:
                for rest in comps(n - p):
                    yield (p,) + rest

    seen, res = set(), []
    for c in comps(L):
        heads = np.cumsum((0,) + c[:-1])
        for off in range(L):
            h = tuple(sorted(int(x) for x in (heads + off) % L))
            if h in seen:
                continue
            seen.add(h)
            m = np.zeros(L, bool)
            m[list(h)] = True
            res.append((float(profile[m].mean() - profile[~m].mean()), h))
    res.sort(key=lambda x: -x[0])
    out = []
    for score, h in res[:top]:
        groups = [((h[(i + 1) % len(h)] - h[i]) % L) or L for i in range(len(h))]
        out.append({"score": round(score, 3), "heads": list(h), "groups": groups})
    return out


def split_bars(groups: list[int], heads: list[int], profile: np.ndarray, max_bar=8):
    """Group the additive groups into bars whose heads are the strongest accents."""
    n = len(groups)
    best = None
    for bars in range(1, n + 1):
        if n % bars:
            continue
        per = n // bars
        for start in range(per):
            idx = [(start + i * per) % n for i in range(bars)]
            sizes = [sum(groups[(j + i) % n] for i in range(per)) for j in idx]
            if max(sizes) > max_bar:
                continue
            s = float(np.mean([profile[heads[j]] for j in idx]))
            if best is None or s > best[0] + 0.05 or (abs(s - best[0]) <= 0.05 and bars < best[1]):
                best = (s, bars, start, per)
    if best is None:
        return None
    _, bars, start, per = best
    order = [groups[(start + i) % n] for i in range(n)]
    pattern = ",".join("+".join(str(g) for g in order[b * per : (b + 1) * per]) for b in range(bars))
    return {"pattern": pattern, "phase": heads[start]}


# --------------------------------------------------------------------------- confidence


def rhythm_confidence(audio: Audio, grid: np.ndarray, raw: np.ndarray, down_idx: np.ndarray, barpos: np.ndarray,
                      window=4.0):
    """Per window: how much the music itself marks the beat and the bar.

    beat  = share of grid beats with a raw Beat This! beat within 40 ms and an onset peak
    bar   = share of Beat This! downbeats in the window that land on the chosen bar phase
    """
    on_t, on_s = audio.onsets(0.2)
    out = []
    for s in np.arange(0, audio.duration, window):
        gi = np.where((grid >= s) & (grid < s + window))[0]
        if not len(gi):
            continue
        g = grid[gi]
        hit_raw = np.array([np.min(np.abs(raw - x)) < 0.04 for x in g]) if len(raw) else np.zeros(len(g), bool)
        hit_on = np.array([np.min(np.abs(on_t - x)) < 0.05 for x in g]) if len(on_t) else np.zeros(len(g), bool)
        di = down_idx[(grid[down_idx] >= s) & (grid[down_idx] < s + window)] if len(down_idx) else np.array([], int)
        bar_ok = float(np.mean(barpos[di] == 0)) if len(di) else 0.0
        beat = float(np.mean(hit_raw) * 0.5 + np.mean(hit_on) * 0.5)
        out.append({"t": round(float(s), 2), "beat": round(beat, 2), "bar": round(bar_ok, 2)})
    return out


def low_regions(conf, window=4.0, beat_min=0.5, bar_min=0.5):
    regs = []
    for c in conf:
        low = c["beat"] < beat_min or c["bar"] < bar_min
        if low:
            if regs and abs(regs[-1][1] - c["t"]) < 1e-6:
                regs[-1][1] = c["t"] + window
            else:
                regs.append([c["t"], c["t"] + window])
    return [[round(a, 2), round(b, 2)] for a, b in regs]


# --------------------------------------------------------------------------- analyze


def analyze(path: Path):
    raw, raw_down = run_beat_this(path)
    audio = Audio(path)
    grid, segs, ref, seg_of = fit_tempo(raw, audio.duration)
    acc = audio.accents(grid)
    meter, phases, agreement, down_idx, barpos = meter_from_downbeats(grid, raw_down, seg_of)
    phase = int(np.argmax(barpos == 0)) % meter  # global-index phase, exact when there is one segment

    # Accent cycle: if the strongest periodicity is not a plain bar (or its multiple), the meter
    # may be additive. Fit 2/3 groupings and bar splits.
    cyc = accent_cycle(acc["total"])
    cycle_info = {"top": [{"lag": l, "r": round(r, 3)} for l, r in cyc[:5]]}
    if cyc:
        L, r = cyc[0]
        second = next((rr for ll, rr in cyc[1:] if ll % L and L % ll), 0.0)
        k = np.arange(len(grid))
        prof = np.array([acc["total"][k % L == p].mean() for p in range(L)])
        cycle_info.update({"length": L, "r": round(r, 3), "secondR": round(second, 3)})
        plain = L % meter == 0 and all(L % m for m in (5, 7, 11))
        if r > 0.4 and r > 2 * max(second, 0.05) and not plain:
            groups = fit_groups(prof)
            cycle_info["groupings"] = groups
            if groups:
                sb = split_bars(groups[0]["groups"], groups[0]["heads"], prof)
                if sb:
                    cycle_info["suggestedPattern"] = sb

    conf = rhythm_confidence(audio, grid, raw, down_idx, barpos)

    # Sections: agglomerative clustering over bar-synchronous features.
    sections = []
    downs = grid[barpos == 0]
    # Leave out bars after the music has stopped (a silent or fading tail would win a cluster).
    bar_db = audio.beat_db(downs) if len(downs) else np.array([])
    last_loud = int(np.max(np.where(bar_db > -30)[0])) if np.any(bar_db > -30) else len(downs) - 1
    downs = downs[: last_loud + 1]
    if len(downs) > 4:
        chroma = librosa.feature.chroma_cqt(y=audio.y, sr=SR, hop_length=512)
        mfcc = librosa.feature.mfcc(y=audio.y, sr=SR, hop_length=512, n_mfcc=13)
        feat = np.vstack([librosa.util.normalize(chroma), librosa.util.normalize(mfcc)])
        bf = librosa.time_to_frames(downs, sr=SR, hop_length=512)
        sync = librosa.util.sync(feat, bf, aggregate=np.median)
        kk = max(2, min(12, round(audio.duration / 20)))
        for b in librosa.segment.agglomerative(sync, kk):
            if 0 < b <= len(downs):
                sections.append(round(float(downs[b - 1]), 4))

    # Suggested pulse level: every N grid beats, nearest 120 BPM within 60–160, compatible with the meter.
    bpm0 = 60 / [s for s in segs if not s["free"]][0]["period"] if any(not s["free"] for s in segs) else 60 / ref
    cands = [n for n in (1, 2, 3, 4) if meter % n == 0 or n == meter]
    level = min(cands, key=lambda n: (not (60 <= bpm0 / n <= 160), abs(bpm0 / n - 120)))

    on_t, on_s = audio.onsets(0.15)
    db = audio.beat_db(grid)
    return {
        "version": 1,
        "source": path.name,
        "duration": round(audio.duration, 3),
        "tempo": [
            {"start": round(s["start"] if i else 0.0, 3), "bpm": None if s["free"] else round(60 / s["period"], 3),
             "free": s["free"], "residualMs": round(s["residualMs"], 1), "inliers": round(s["inliers"], 3)}
            for i, s in enumerate(segs)
        ],
        "grid": [round(float(t), 4) for t in grid],
        "gridBarPos": [int(x) for x in barpos],
        "gridDb": [round(float(v), 1) for v in db],
        "meter": meter,
        "downbeatPhase": phase,
        "segmentPhases": phases,
        "downbeatAgreement": round(agreement, 3),
        "accentCycle": cycle_info,
        "suggest": {"every": level, "bar": meter, "phase": phase,
                    **({"pattern": cycle_info["suggestedPattern"]["pattern"],
                        "patternPhase": cycle_info["suggestedPattern"]["phase"]} if "suggestedPattern" in cycle_info else {})},
        "confidence": conf,
        "lowConfidence": low_regions(conf),
        "sections": sections,
        "onsets": [[round(float(t), 3), round(float(s), 2)] for t, s in zip(on_t, on_s)],
        "raw": {"beats": [round(float(t), 3) for t in raw], "downbeats": [round(float(t), 3) for t in raw_down]},
    }


def summary(a):
    t = " → ".join(("free" if s["free"] else f"{s['bpm']:.2f}") + f"@{s['start']:.1f}s" for s in a["tempo"])
    c = a["accentCycle"]
    lines = [
        f"{a['source']}: tempo {t}",
        f"  meter {a['meter']} (downbeat agreement {a['downbeatAgreement']}), phase {a['downbeatPhase']}, "
        f"suggest {a['suggest']}",
        f"  accent cycle {c.get('length')} r={c.get('r')} (2nd {c.get('secondR')})"
        + (f", groupings {[g['groups'] for g in c.get('groupings', [])[:2]]}" if c.get("groupings") else ""),
        f"  low confidence {a['lowConfidence']}  sections {a['sections']}",
    ]
    return "\n".join(lines)


def plot(a, audio_path: Path, png: Path):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    y, sr = librosa.load(str(audio_path), sr=8000, mono=True)
    dur = len(y) / sr
    rows = max(1, math.ceil(dur / 15))
    fig, axes = plt.subplots(rows, 1, figsize=(18, 2.0 * rows), squeeze=False)
    tt = np.arange(len(y)) / sr
    grid = np.array(a["grid"])
    k = np.arange(len(grid))
    sug = a["suggest"]
    if "pattern" in sug:
        bars = [[int(x) for x in b.split("+")] for b in sug["pattern"].split(",")]
        L = sum(map(sum, bars))
        heads, downs, o = set(), set(), 0
        for b in bars:
            downs.add(o)
            for g in b:
                heads.add(o)
                o += g
        r = (k - sug["patternPhase"]) % L
        is_pulse = np.isin(r, list(heads))
        is_down = np.isin(r, list(downs))
    else:
        r = np.asarray(a["gridBarPos"]) if sug["bar"] == a["meter"] else (k - sug["phase"]) % sug["bar"]
        is_pulse = r % sug["every"] == 0
        is_down = r == 0
    for row in range(rows):
        ax = axes[row][0]
        s, e = row * 15, (row + 1) * 15
        m = (tt >= s) & (tt < e)
        ax.plot(tt[m], y[m], lw=0.3, color="#888")
        for t, p, d in zip(grid, is_pulse, is_down):
            if s <= t < e:
                ax.axvline(t, color="#d33" if d else ("#36c" if p else "#ccc"), lw=1.6 if d else (0.9 if p else 0.5))
        for t in a["raw"]["beats"]:
            if s <= t < e:
                ax.plot([t, t], [-1.0, -0.85], color="#000", lw=1)
        for lo, hi in a["lowConfidence"]:
            if hi > s and lo < e:
                ax.axvspan(max(lo, s), min(hi, e), color="#fc0", alpha=0.15)
        for seg in a["tempo"][1:]:
            if s <= seg["start"] < e:
                ax.axvline(seg["start"], color="#a0f", lw=3, alpha=0.6)
        for t in a["sections"]:
            if s <= t < e:
                ax.axvline(t, color="#f90", lw=3, alpha=0.5)
        ax.set_xlim(s, e)
        ax.set_ylim(-1, 1)
        ax.set_yticks([])
    fig.suptitle("red=downbeat blue=pulse grey=grid  black=raw beats  purple=tempo change  orange=section  yellow=low confidence")
    fig.tight_layout()
    fig.savefig(png, dpi=60)


# --------------------------------------------------------------------------- export


def export(a, every=None, bar=None, phase=None, pattern=None, t0=0.0, t1=None):
    grid = np.array(a["grid"])
    db = a["gridDb"]
    sug = a["suggest"]
    if pattern is None and every is None and bar is None and "pattern" in sug:
        pattern, phase = sug["pattern"], sug["patternPhase"] if phase is None else phase
    beats, sub = [], []
    if pattern:
        bars = [[int(x) for x in b.split("+")] for b in pattern.split(",")]
        L = sum(map(sum, bars))
        head, o = {}, 0
        for b in bars:
            for gi, g in enumerate(b):
                head[o] = gi + 1
                o += g
        for k, t in enumerate(grid):
            r = (k - (phase or 0)) % L
            (beats.append([t, head[r], db[k]]) if r in head else sub.append(t))
        meter = max(len(b) for b in bars)
    else:
        every = every or sug["every"]
        bar = bar or sug["bar"]
        phase = sug["phase"] if phase is None else phase
        if bar % every:
            raise SystemExit("bar must be a multiple of every")
        use_pos = bar == a["meter"] and phase == sug["phase"]
        for k, t in enumerate(grid):
            r = a["gridBarPos"][k] if use_pos else (k - phase) % bar
            (beats.append([t, r // every + 1, db[k]]) if r % every == 0 else sub.append(t))
        meter = bar // every

    def keep(t):
        return t >= t0 and (t1 is None or t < t1)

    beats = [[round(float(t), 4), int(p), d] for t, p, d in beats if keep(t)]
    sub = [round(float(t), 4) for t in sub if keep(t)]
    downs = [t for t, p, _ in beats if p == 1]
    secs = sorted({min(downs, key=lambda x: abs(x - s)) for s in a["sections"] if keep(s)}) if downs else []
    secs = [s for s in secs if downs and s > downs[0] + 1e-3]
    ibis = np.diff([b[0] for b in beats])
    return {
        "version": 1,
        "source": a["source"],
        "bpm": round(60 / float(np.median(ibis)), 3) if len(ibis) else 120,
        "meter": meter,
        "pattern": pattern,
        "tempo": a["tempo"],
        "beats": beats,
        "sub": sub,
        "sections": secs,
        "onsets": [o for o in a["onsets"] if keep(o[0])],
        "lowConfidence": [r for r in a["lowConfidence"] if r[1] > t0 and (t1 is None or r[0] < t1)],
    }


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    an = sp.add_parser("analyze")
    an.add_argument("audio", type=Path)
    an.add_argument("-o", "--out", type=Path, required=True)
    an.add_argument("--png", type=Path)
    ex = sp.add_parser("export")
    ex.add_argument("analysis", type=Path)
    ex.add_argument("-o", "--out", type=Path, required=True)
    ex.add_argument("--every", type=int)
    ex.add_argument("--bar", type=int)
    ex.add_argument("--phase", type=int)
    ex.add_argument("--pattern")
    ex.add_argument("--from", dest="t0", type=float, default=0.0)
    ex.add_argument("--to", dest="t1", type=float)
    a = ap.parse_args()

    if a.cmd == "analyze":
        res = analyze(a.audio)
        a.out.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
        print(summary(res))
        if a.png:
            plot(res, a.audio, a.png)
    else:
        res = json.loads(a.analysis.read_text(encoding="utf-8"))
        out = export(res, a.every, a.bar, a.phase, a.pattern, a.t0, a.t1)
        a.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{out['source']}: {len(out['beats'])} pulses, meter {out['meter']}, pattern {out['pattern']}, "
              f"~{out['bpm']} BPM, sections {out['sections']}, low confidence {out['lowConfidence']}")


if __name__ == "__main__":
    main()
