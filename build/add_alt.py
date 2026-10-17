"""Add the alternate (Kansai-accent) WaniKani/Tofugu recordings as `alt` clips, and drop helper keys.

Run AFTER build2.py + qa.py and BEFORE tts/gen.py.
Usage: python3 build/add_alt.py <tofugu-repo-dir> <out-dir>      (uses build/hira_rows.json)
- hiragana items with no Tokyo-male clip get audio/f###.mp3 as `alt` (the only recording we have, Kansai accent)
- the 4 phrases that have a Tofugu clip get audio/pf##.mp3 as `alt`
"""
import json, os, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
REPO, OUT = sys.argv[1], sys.argv[2]
mp3 = os.path.join(REPO, 'lib', 'mp3')
hira = json.load(open(os.path.join(ROOT, 'build', 'hira_rows.json'), encoding='utf-8'))
d = json.load(open(os.path.join(OUT, 'data.json'), encoding='utf-8'))
os.makedirs(os.path.join(OUT, 'audio'), exist_ok=True)
for i, (r, row) in enumerate(zip(hira, d['hira'])):
    assert row['kana'] == r['rd']
    if row['audio'] is None:
        dst = f'audio/f{i:03d}.mp3'; shutil.copyfile(os.path.join(mp3, r['file']), os.path.join(OUT, dst)); row['alt'] = dst
PHRASE_CLIPS = {'こんにちは': '今日は【こんにちは】.mp3', 'ありがとう': '有り難う【ありがとう】.mp3',
                'ごめんなさい': '御免なさい【ごめんなさい】.mp3', 'よろしくおねがいします': '宜しくお願いします【よろしくおねがいします】.mp3'}
for i, ph in enumerate(d['phr']):
    k = ''.join(c['w'] + c['p'] for c in ph['chunks'])
    if k in PHRASE_CLIPS:
        dst = f'audio/pf{i:02d}.mp3'; shutil.copyfile(os.path.join(mp3, PHRASE_CLIPS[k]), os.path.join(OUT, dst)); ph['alt'] = dst
for row in d['hira']: row.pop('kanji', None)
json.dump(d, open(os.path.join(OUT, 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('alt clips added')
