from gen_common import *
DATA=json.load(open(OUT+'data.json',encoding='utf-8'))
log=[]; nclip=0
def do(item, key, chunks, q_flag, idx_name):
    global nclip
    for sp,tag in ((MALE,'tm'),):
        x,sr,q,err=make(chunks,sp,q_flag)
        if err: log.append((idx_name,err)); continue
        name=f'{tag}_{idx_name}'; save(x,sr,name); nclip+=1
        item['tts' if sp==MALE else 'ttsF']=f'audio/{name}.mp3'
        if sp==MALE and key=='phr':
            mt=mora_times(q,1.0); item['tl']=[round(t0,3) for t0,_,_ in mt]; item['tend']=round(mt[-1][1],3); item['tdur']=round(len(x)/sr,3)
for i,r in enumerate(DATA['hira']):
    if r.get('audio'): continue
    do(r,'hira',[(r['kana'],first_int(r['accent']))],False,f'h{i:03d}')
print('hira done',nclip,flush=True)
for i,r in enumerate(DATA['kata']):
    do(r,'kata',[(r['kana'],first_int(r['accent']))],False,f'k{i:03d}')
print('kata done',nclip,flush=True)
for i,r in enumerate(DATA['phr']):
    chunks=[(pron(c['w'],c['p']),c['a']) for c in r['chunks']]
    do(r,'phr',chunks,r.get('q',False),f'p{i:02d}')
print('phr done',nclip,flush=True)
json.dump(DATA,open(OUT+'data.json','w',encoding='utf-8'),ensure_ascii=False)
print('clips',nclip,'problems',log)
