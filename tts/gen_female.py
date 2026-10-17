"""Generate the female voice (VOICEVOX 九州そら, style 16) for every item and bundle all clips
into ONE mp3 (out/audio/female_voice.mp3). Each item gets ttsF={o,l} (byte offset, length);
phrases also get tlF/tendF. Needs the VOICEVOX engine on :50021."""
import json, os, sys, io, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf
import gen_common as g
from vv_lib import *
FEMALE = 16; g.INTON[FEMALE] = 1.3
S = g.S; OUT = g.OUT
DATA = json.load(open(OUT + 'data.json', encoding='utf-8'))
blob = bytearray(); log = []
def enc(x, sr):
    x = np.asarray(x, float); pk = np.max(np.abs(x)); x = x / pk * 0.7 if pk > 0 else x
    p = subprocess.run(['ffmpeg','-v','quiet','-f','wav','-i','-','-ac','1','-ar','24000','-b:a','48k','-f','mp3','-'],
                       input=_wav(x, sr), capture_output=True, check=True)
    return p.stdout
def _wav(x, sr):
    b = io.BytesIO(); sf.write(b, x, sr, format='WAV'); return b.getvalue()
def add(item, chunks, q_flag, name, phr=False):
    x, sr, q, err = g.make(chunks, FEMALE, q_flag)
    if err: log.append((name, err)); return
    m = enc(x, sr); item['ttsF'] = {'o': len(blob), 'l': len(m)}; blob.extend(m)
    if phr:
        mt = mora_times(q, 1.0); item['tlF'] = [round(t0, 3) for t0, _, _ in mt]; item['tendF'] = round(mt[-1][1], 3)
for i, r in enumerate(DATA['hira']): add(r, [(r['kana'], g.first_int(r['accent']))], False, f'h{i}')
for i, r in enumerate(DATA['kata']): add(r, [(r['kana'], g.first_int(r['accent']))], False, f'k{i}')
for i, r in enumerate(DATA['phr']):
    add(r, [(g.pron(c['w'], c['p']), c['a']) for c in r['chunks']], r.get('q', False), f'p{i}', True)
open(OUT + 'audio/female_voice.mp3', 'wb').write(blob)
json.dump(DATA, open(OUT + 'data.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('bytes', len(blob), 'problems', log)
