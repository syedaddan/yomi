import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import json, re, os, sys, subprocess, numpy as np, soundfile as sf
sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
from vv_lib import *
S=(ROOT+'/')
OUT=S+'out/'
MALE = 12                   # 白上虎太郎 (ふつう)
INTON = {MALE: 1.3}
os.makedirs(S+'tts/wav',exist_ok=True)
def first_int(s): return int(re.search(r'\d+',s).group())
PRON_W={'こんにちは':'こんにちわ','こんばんは':'こんばんわ'}
PRON_P={'は':'わ','を':'お','へ':'え'}
def pron(w,p):
    w=PRON_W.get(w,w)
    p=''.join(PRON_P.get(c,c) if i==0 else c for i,c in enumerate(p)) if p and p[0] in PRON_P else p
    return w+p
def chunk_accent(txt,a,sp):
    if a is not None: return a
    ap=post('/accent_phrases',{'text':h2k(txt),'speaker':sp,'is_kana':'false'})
    return ap[0]['accent'] if ap else 0
def make(chunks, sp, q_flag=False):
    ch=[(t,chunk_accent(t,a,sp)) for t,a in chunks]
    q=build_query(ch,sp,1.0,INTON[sp],q_flag)
    if q is None: return None,None,None,'mora-count mismatch'
    got=[m['text'] for ph in q['accent_phrases'] for m in ph['moras']]
    exp=moras(h2k(''.join(t for t,_ in ch)))
    VOW=set('アイウエオ')
    bad=[(g,e) for g,e in zip(got,exp) if g!=e and not (g in VOW and (e=='ー' or e in VOW))]
    if len(got)!=len(exp) or bad: return None,None,None,'mora mismatch %s vs %s'%(''.join(got),''.join(exp))
    x,sr=render(q,sp); return x,sr,q,None
def save(x,sr,name):
    x=np.asarray(x,float); pk=np.max(np.abs(x)); x=x/pk*0.7 if pk>0 else x
    wav=S+'tts/wav/'+name+'.wav'; sf.write(wav,x,sr)
    subprocess.run(['ffmpeg','-y','-v','quiet','-i',wav,'-ac','1','-ar','24000','-b:a','48k',OUT+'audio/'+name+'.mp3'],check=True)
