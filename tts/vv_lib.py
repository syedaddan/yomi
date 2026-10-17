import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import json, re, io, urllib.request, urllib.parse, numpy as np, soundfile as sf
API='http://127.0.0.1:50021'
SMALL_Y='ゃゅょャュョ'; SMALL_V='ぁぃぅぇぉァィゥェォ'
def moras(s):
    out=[]
    for ch in s:
        if (ch in SMALL_Y or ch in SMALL_V) and out: out[-1]+=ch
        else: out.append(ch)
    return out
def h2k(s):
    return ''.join(chr(ord(c)+0x60) if 'ぁ'<=c<='ゖ' else c for c in s)
def kana_for_engine(text, accent):
    """text: reading in kana (particles already as pronounced). accent: dictionary accent (0=flat)."""
    k=h2k(text); ms=moras(k); n=len(ms)
    a = n if (accent==0 or accent>n) else accent
    return ''.join(ms[:a])+"'"+''.join(ms[a:])
def post(path, params=None, body=None, raw=False):
    url=API+path+('?'+urllib.parse.urlencode(params) if params else '')
    req=urllib.request.Request(url, data=(json.dumps(body).encode() if body is not None else b''), method='POST', headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r: d=r.read()
    return d if raw else json.loads(d)
def synth(kana, speaker, speed=1.0, pause=None, kana_mode=True):
    q=post('/audio_query',{'text':kana,'speaker':speaker,'is_kana':'true' if kana_mode else 'false'})
    q['speedScale']=speed; q['prePhonemeLength']=0.12; q['postPhonemeLength']=0.12
    wav=post('/synthesis',{'speaker':speaker},q,raw=True)
    x,sr=sf.read(io.BytesIO(wav)); 
    if x.ndim>1: x=x[:,0]
    return x,sr,q
def mora_times(q, speed):
    t=q['prePhonemeLength']/ (1.0)  # pre/post are not scaled by speedScale in the engine
    out=[]
    for ph in q['accent_phrases']:
        for m in ph['moras']:
            d=((m.get('consonant_length') or 0)+m['vowel_length'])/speed
            out.append((t,t+d,m['text'])); t+=d
        if ph.get('pause_mora'):
            t+=ph['pause_mora']['vowel_length']/speed
    return out
def f0_track(x,sr):
    fl=int(.04*sr); hop=int(.01*sr); lo=int(sr/450); hi=int(sr/70)
    thr=0.2*np.sqrt(np.mean(x**2)); out=[]
    for i in range(0,len(x)-fl,hop):
        fr=x[i:i+fl]
        if np.sqrt(np.mean(fr**2))<thr: out.append((i/sr,None)); continue
        fr=fr-fr.mean(); ac=np.correlate(fr,fr,'full')[fl-1:]; seg=ac[lo:hi]; k=int(np.argmax(seg))
        out.append((i/sr, sr/(k+lo) if ac[0]>0 and seg[k]/ac[0]>0.45 else None))
    return out

def build_query(chunks, speaker, speed=1.0, intonation=1.0, question=False):
    """chunks: list of (kana_as_pronounced, accent). One accent phrase per chunk, accent forced from the dictionary."""
    full=''.join(h2k(c[0]) for c in chunks)
    q=post('/audio_query',{'text':full,'speaker':speaker})
    flat=[m for ph in q['accent_phrases'] for m in ph['moras']]
    want=sum(len(moras(c[0])) for c in chunks)
    if len(flat)!=want: return None
    phrases=[]; i=0
    for k,(txt,a) in enumerate(chunks):
        n=len(moras(txt)); ms=flat[i:i+n]; i+=n
        acc = n if (a is None or a==0 or a>n) else a
        phrases.append({'moras':ms,'accent':acc,'pause_mora':None,'is_interrogative':bool(question and k==len(chunks)-1)})
    phrases=post('/mora_data',{'speaker':speaker},phrases)
    q['accent_phrases']=phrases
    q['speedScale']=speed; q['intonationScale']=intonation; q['prePhonemeLength']=0.12; q['postPhonemeLength']=0.12
    return q
def render(q, speaker):
    wav=post('/synthesis',{'speaker':speaker},q,raw=True)
    x,sr=sf.read(io.BytesIO(wav))
    if x.ndim>1: x=x[:,0]
    return x,sr
