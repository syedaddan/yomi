import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import json,re,random,sys,numpy as np
sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
from vv_lib import *
S=ROOT+_os.sep
D=json.load(open(S+'out/data.json',encoding='utf-8'))
def pat(n,a):
    if a==0: return [0]+[1]*(n-1)
    if a==1: return [1]+[0]*(n-1)
    return [0]+[1]*(a-1)+[0]*(n-a)
W=[]
for sec in ('hira','kata'):
    for r in D[sec]:
        a=int(re.search(r'\d+',r['accent']).group()); n=len(moras(r['kana']))
        if n>=2 and not (a==n and a>1): W.append((r['kana'],n,a))
random.seed(7); random.shuffle(W); W=W[:140]
voices={'もち子さん':20,'九州そら':16,'春日部つむぎ':8,'四国めたん':2,'冥鳴ひまり':14}
inton=1.3
for name,sp in voices.items():
    ok=tot=0
    for w,n,a in W:
        q=build_query([(w,a)],sp,1.0,inton)
        if q is None: continue
        x,sr=render(q,sp); tr=f0_track(x,sr); mt=mora_times(q,1.0)
        if len(mt)!=n: continue
        st=[]
        for (t0,t1,_) in mt:
            v=[12*np.log2(f) for t,f in tr if f and t0<=t<t1]
            st.append(np.median(v) if v else np.nan)
        st=np.array(st); p=np.array(pat(n,a),float)
        if np.isnan(st).any() or p.std()==0: continue
        tot+=1; ok+= 1 if np.corrcoef(p,st)[0,1]>0.2 else 0
    print(name,sp,'pitch-agree',ok,'/',tot,'=',round(100*ok/max(1,tot)),'%',flush=True)
