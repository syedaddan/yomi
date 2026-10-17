import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import json,re,subprocess,sys,numpy as np
sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
from vv_lib import moras,f0_track
S=(ROOT+'/')
D=json.load(open(S+'out/data.json',encoding='utf-8'))
def dec(p):
    raw=subprocess.run(['ffmpeg','-v','quiet','-i',S+'out/'+p,'-ac','1','-ar','24000','-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.int16).astype(float)/32768,24000
bad=0
for i,r in enumerate(D['phr']):
    n=len(moras(''.join(c['w']+c['p'] for c in r['chunks'])))
    if len(r['tl'])!=n: bad+=1; print('timeline mismatch',i,len(r['tl']),n)
    dur=float(subprocess.run(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',S+'out/'+r['tts']],capture_output=True,text=True).stdout)
    if abs(dur-r['tdur'])>0.15: print('dur off',i,dur,r['tdur'])
print('phrase timeline check: bad =',bad,'of',len(D['phr']))
def pat(n,a):
    if a==0: return [0]+[1]*(n-1)
    if a==1: return [1]+[0]*(n-1)
    return [0]+[1]*(a-1)+[0]*(n-a)
def agree(path,n,a):
    x,sr=dec(path); tr=f0_track(x,sr); v=[(t,f) for t,f in tr if f]
    if len(v)<6: return None
    t0,t1=v[0][0],v[-1][0]; seg=(t1-t0)/n; st=[]
    for k in range(n):
        vv=[12*np.log2(f) for t,f in v if t0+k*seg<=t<t0+(k+1)*seg]; st.append(np.median(vv) if vv else np.nan)
    st=np.array(st); p=np.array(pat(n,a),float)
    if np.isnan(st).any() or p.std()==0: return None
    return 1 if np.corrcoef(p,st)[0,1]>0.2 else 0
for tag,key in (('male','tts'),('female','ttsF')):
    ok=tot=0
    for sec in ('hira','kata'):
        for r in D[sec]:
            if key not in r: continue
            a=int(re.search(r'\d+',r['accent']).group()); n=len(moras(r['kana']))
            if n<2 or (a==n and a>1): continue
            s=agree(r[key],n,a)
            if s is not None: tot+=1; ok+=s
    print(tag,'single-word clips: pitch follows dictionary accent',ok,'/',tot,'=',round(100*ok/tot),'%')
