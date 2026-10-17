import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import sys, os, json, subprocess, shutil, re
import numpy as np
REPO, OUT = sys.argv[1], sys.argv[2]
mp3dir = os.path.join(REPO, "lib", "mp3")

def f0_track(path):
    raw = subprocess.run(["ffmpeg","-v","quiet","-i",path,"-ac","1","-ar","16000","-f","s16le","-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    fl, hop = 640, 160
    thr = 0.3 * np.sqrt(np.mean(x**2))
    out = []
    for i in range(0, len(x)-fl, hop):
        fr = x[i:i+fl]
        if np.sqrt(np.mean(fr**2)) < thr: continue
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, mode="full")[fl-1:]
        lo, hi = 40, 228
        seg = ac[lo:hi]; k = int(np.argmax(seg))
        if ac[0] > 0 and seg[k]/ac[0] > 0.5: out.append(16000/(k+lo))
    return np.array(out)

data = json.load(open(os.path.join(OUT, "data.json"), encoding="utf-8"))
hira = json.load(open(sys.argv[3], encoding="utf-8"))
byrd = {(r["rd"], r["accent"]): r for r in hira}

# ---- QA: do male clips follow the dictionary accent? ----
SMALL = set("ゃゅょ")
def nm(s): return len([c for c in s if c not in SMALL])
ok = bad = skip = 0; bads = []
for r in data["hira"]:
    if not r["audio"]: continue
    n = nm(r["kana"]); a = int(re.search(r"\d+", r["accent"]).group())
    if n not in (2, 3) or (n == 3 and a not in (0, 1)) or (n == 2 and a not in (0, 1, 2)): skip += 1; continue
    f = f0_track(os.path.join(OUT, r["audio"]))
    if len(f) < 8: skip += 1; continue
    t = len(f) // 3
    early, late = np.median(f[:t]), np.median(f[-t:])
    pred_fall = (a == 1)
    got_fall = early > late
    if pred_fall == got_fall: ok += 1
    else: bad += 1; bads.append((r["kana"], a, round(float(early)), round(float(late))))
print("QA contour agreement:", ok, "ok /", bad, "disagree /", skip, "skipped")
print("disagreements:", bads)

# ---- phrase clips: keep only male-voice ones ----
CLIPS = {"こんにちは": "今日は【こんにちは】.mp3", "ありがとう": "有り難う【ありがとう】.mp3",
         "ごめんなさい": "御免なさい【ごめんなさい】.mp3", "よろしくおねがいします": "宜しくお願いします【よろしくおねがいします】.mp3"}
def key(ph): return "".join(c["w"] + c["p"] for c in ph["chunks"])
for i, ph in enumerate(data["phr"]):
    k = key(ph)
    if k in CLIPS:
        f = f0_track(os.path.join(mp3dir, CLIPS[k])); med = float(np.median(f))
        print("phrase clip", k, "median F0", round(med), "male" if med < 170 else "female->TTS")
        if med < 170:
            dst = f"audio/p{i:02d}.mp3"
            shutil.copyfile(os.path.join(mp3dir, CLIPS[k]), os.path.join(OUT, dst)); ph["audio"] = dst
json.dump(data, open(os.path.join(OUT, "data.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("files in audio/:", len(os.listdir(os.path.join(OUT, "audio"))))
