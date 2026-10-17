import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import sys, os, re, json, subprocess, collections
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from candidates import HIRA

REPO = sys.argv[1]; KJ = sys.argv[2]; OUT = sys.argv[3]
mp3dir = os.path.join(REPO, "lib", "mp3")
clips = set(os.listdir(mp3dir))

acc = collections.defaultdict(list)
for l in open(KJ, encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if len(p) >= 3: acc[p[0]].append((p[1], p[2]))

def f0_median(path):
    raw = subprocess.run(["ffmpeg","-v","quiet","-i",path,"-ac","1","-ar","16000","-f","s16le","-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    if len(x) < 4000: return None
    fl, hop = 640, 160  # 40ms / 10ms
    f0s = []
    thr = 0.1 * np.sqrt(np.mean(x**2)) * 3
    for i in range(0, len(x)-fl, hop):
        fr = x[i:i+fl]
        if np.sqrt(np.mean(fr**2)) < thr: continue
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, mode="full")[fl-1:]
        lo, hi = int(16000/400), int(16000/70)
        seg = ac[lo:hi]
        k = np.argmax(seg)
        if ac[0] > 0 and seg[k]/ac[0] > 0.5:
            f0s.append(16000/(k+lo))
    return float(np.median(f0s)) if len(f0s) > 5 else None

rows, drops = [], []
for hw, rd, en, th in HIRA:
    fn = f"{hw}【{rd}】.mp3"
    if fn not in clips:
        drops.append((hw, rd, "no clip")); continue
    a = [x for (r, x) in acc.get(hw, []) if r == rd]
    if not a:
        drops.append((hw, rd, "no accent")); continue
    f0 = f0_median(os.path.join(mp3dir, fn))
    rows.append(dict(hw=hw, rd=rd, en=en, th=th, file=fn, accent=a[0], f0=f0))

json.dump(rows, open(OUT, "w"), ensure_ascii=False, indent=0)
print("kept", len(rows), "dropped", len(drops))
print("drops:", drops)
fs = [r["f0"] for r in rows if r["f0"]]
print("f0 hist:", np.histogram(fs, bins=[60,100,120,140,155,170,185,200,230,300,500])[0].tolist())
