import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import json,re,random,sys,numpy as np
sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
from vv_lib import *
S=(ROOT+'/')
data=json.load(open(S+'out/data.json',encoding='utf-8'))
def pat(n,a):
    if a==0: return [0]+[1]*(n-1)
    if a==1: return [1]+[0]*(n-1)
    return [0]+[1]*(a-1)+[0]*(n-a)
words=[]
for r in data['hira']:
    a=int(re.search(r'\d+',r['accent']).group()); n=len(moras(r['kana']))
    if 2<=n<=5 and not (a==n and a>1): words.append((r['kana'],n,a))
random.seed(1); random.shuffle(words); words=words[:40]
voices={'玄野武宏':11,'白上虎太郎':12,'春日部つむぎ':8,'もち子さん':20,'九州そら':16,'No.7':29}
inton=float(sys.argv[1]) if len(sys.argv)>1 else 1.0
for name,sp in voices.items():
    ok=tot=bad=0
    for w,n,a in words:
        q=build_query([(w,a)],sp,1.0,inton)
        if q is None: bad+=1; continue
        x,sr=render(q,sp); tr=f0_track(x,sr); mt=mora_times(q,1.0)
        if len(mt)!=n: bad+=1; continue
        st=[]
        for (t0,t1,_) in mt:
            v=[12*np.log2(f) for t,f in tr if f and t0<=t<t1]
            st.append(np.median(v) if v else np.nan)
        st=np.array(st); p=np.array(pat(n,a),float)
        if np.isnan(st).any() or p.std()==0: continue
        tot+=1; ok+= 1 if np.corrcoef(p,st)[0,1]>0.2 else 0
    print(name,sp,'pitch-agree',ok,'/',tot,' (skipped',bad,')',flush=True)
