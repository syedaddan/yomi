import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
import sys, os, re, json, shutil, collections
HERE = os.path.dirname(__file__)
REPO, KJ, HIRA_JSON, OUTDIR = sys.argv[1:5]
mp3dir = os.path.join(REPO, "lib", "mp3")
clips = set(os.listdir(mp3dir))

# ---------- Kanjium ----------
acc = collections.defaultdict(list)      # headword -> [(reading, "0,2")]
byreading = collections.defaultdict(set) # reading  -> {"0,2", ...}
for l in open(KJ, encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if len(p) < 3: continue
    acc[p[0]].append((p[1], p[2]))
    byreading[p[1] if p[1] else p[0]].add(p[2])

def first_acc(s): return int(re.search(r"\d+", s).group())

# ---------- mora counting ----------
SMALL = set("ゃゅょャュョ")
SMALLV = set("ぁぃぅぇぉァィゥェォ")
def moras(s):
    out = []
    for ch in s:
        if (ch in SMALL or ch in SMALLV) and out: out[-1] += ch
        else: out.append(ch)
    return out

# ---------- katakana deck ----------
KATA = [
 ("Tech", "コンピューター computer|パソコン PC|スマホ smartphone|インターネット internet|メール email|ネット the net|アプリ app|ソフト software|データ data|ファイル file|パスワード password|ウェブ web|サーバー server|ネットワーク network|プログラム program|ログイン login|ダウンロード download|アップロード upload|クリック click|キーボード keyboard|マウス mouse|カメラ camera|テレビ TV|ラジオ radio|ゲーム game|システム system|セキュリティ security|ソフトウェア software|ハードウェア hardware|アカウント account|ブラウザ browser|スクリーン screen|ボタン button|メモリ memory|クラウド cloud|コード code|バグ bug|テスト test|エラー error|アップデート update|ユーザー user|フォルダ folder|リンク link|ページ page|プリンター printer|モニター monitor|バッテリー battery|ケーブル cable|ロボット robot|アイコン icon|メニュー menu|デザイン design|ウイルス virus|バックアップ backup"),
 ("Food & Drink", "コーヒー coffee|ジュース juice|パン bread|ミルク milk|ビール beer|ケーキ cake|アイス ice cream|サラダ salad|カレー curry|ラーメン ramen|ハンバーガー hamburger|ピザ pizza|バナナ banana|トマト tomato|チーズ cheese|バター butter|スープ soup|ステーキ steak|ワイン wine|レモン lemon|ジャム jam|チョコレート chocolate|クッキー cookie|サンドイッチ sandwich|ハム ham|ソーセージ sausage|ポテト potato|スパゲッティ spaghetti|コーラ cola|アイスクリーム ice cream|パスタ pasta|ランチ lunch|メニュー menu"),
 ("Travel & Places", "ホテル hotel|レストラン restaurant|カフェ cafe|コンビニ convenience store|スーパー supermarket|デパート department store|タクシー taxi|バス bus|エレベーター elevator|エスカレーター escalator|トイレ toilet|シャワー shower|ホーム platform|チケット ticket|パスポート passport|ビル building|アパート apartment|マンション condo|プール pool|バイク motorbike|ガイド guide|スタジアム stadium|ポスト mailbox"),
 ("Home & Clothes", "ベッド bed|テーブル table|ドア door|カーテン curtain|ノート notebook|ペン pen|ズボン trousers|スカート skirt|ネクタイ necktie|ハンカチ handkerchief|タオル towel|ティッシュ tissue|コップ cup|スプーン spoon|フォーク fork|ナイフ knife|バッグ bag|ポケット pocket|ベルト belt|セーター sweater|コート coat|ストーブ heater|エアコン air conditioner|ライト light|ランプ lamp"),
 ("School & Fun", "クラス class|アルバイト part-time job|スポーツ sports|サッカー soccer|テニス tennis|ニュース news|ドラマ drama|アニメ anime|マンガ manga|ギター guitar|ピアノ piano|ペット pet|レポート report|ゴルフ golf|ジム gym|スキー skiing|ダンス dance|カラオケ karaoke|コンサート concert|パーティー party|ミーティング meeting|プロジェクト project|チーム team|ルール rule"),
 ("Look-alikes (シ ツ ソ ン)", "シャツ shirt|ツアー tour|ソース sauce|ソファー sofa|ツナ tuna|シンプル simple|ソーダ soda|ソックス socks|シーツ bed sheet|パンツ pants|ツイン twin|スーツ suit|ソフトクリーム soft serve|シンガポール Singapore|ホットドッグ hot dog|ジャンプ jump|ランチ lunch|ミント mint"),
]
kata_rows, kata_drops, seen = [], [], set()
for theme, blob in KATA:
    for item in blob.split("|"):
        w, en = item.split(" ", 1)
        if w in seen: continue
        seen.add(w)
        a = [x for (r, x) in acc.get(w, []) if r == ""]
        if not a: kata_drops.append(w); continue
        kata_rows.append(dict(kana=w, en=en, theme=theme, accent=a[0]))

# ---------- hiragana deck (male = Tokyo-accent clips only) ----------
hira = json.load(open(HIRA_JSON, encoding="utf-8"))
os.makedirs(os.path.join(OUTDIR, "audio"), exist_ok=True)
hira_rows, n_clip, n_f = [], 0, 0
for i, r in enumerate(hira):
    male = r["f0"] is not None and r["f0"] < 170
    audio = None
    if male:
        audio = f"audio/h{i:03d}.mp3"
        shutil.copyfile(os.path.join(mp3dir, r["file"]), os.path.join(OUTDIR, audio)); n_clip += 1
    else: n_f += 1
    hira_rows.append(dict(kana=r["rd"], en=r["en"], theme=r["th"], accent=r["accent"], audio=audio,
                          kanji=r["hw"]))

# ---------- phrases ----------
CLIP_PHRASES = {"こんにちは": "こんにちは", "ありがとう": "ありがとう", "ごめんなさい": "ごめんなさい",
                "よろしく おねがい します": "よろしくおねがいします"}
PHR = [
 ("Greetings","おはよう ございます","Good morning (polite)"),
 ("Greetings","こんにちは","Hello / Good afternoon"),
 ("Greetings","こんばんは","Good evening"),
 ("Greetings","ありがとう","Thanks (casual)"),
 ("Greetings","ありがとう ございます","Thank you (polite)"),
 ("Greetings","どういたしまして","You're welcome"),
 ("Greetings","すみません","Excuse me / Sorry"),
 ("Greetings","ごめんなさい","I'm sorry"),
 ("Greetings","はじめまして","Nice to meet you"),
 ("Greetings","よろしく おねがい します","Please treat me well"),
 ("Greetings","いただきます","Said before eating"),
 ("Greetings","ごちそうさま+でした","Said after eating"),
 ("Greetings","いってきます","I'm heading out"),
 ("Greetings","ただいま","I'm home"),
 ("Greetings","おかえりなさい","Welcome back"),
 ("Greetings","おやすみなさい","Good night"),
 ("Greetings","さようなら","Goodbye"),
 ("Greetings","また あした","See you tomorrow"),
 ("Class & Daily","わたし+は がくせい+です","I am a student"),
 ("Class & Daily","わたし+の なまえ+は サイヤッド+です","My name is Saiyaddo"),
 ("Class & Daily","おげんき+ですか","How are you?"),
 ("Class & Daily","げんき+です","I'm fine"),
 ("Class & Daily","これ+は なん+ですか","What is this?"),
 ("Class & Daily","いくら+ですか","How much is it?"),
 ("Class & Daily","わかりません","I don't understand"),
 ("Class & Daily","もう いちど おねがい します","One more time, please"),
 ("Class & Daily","ゆっくり おねがい します","Slowly, please"),
 ("Class & Daily","トイレ+は どこ+ですか","Where is the toilet?"),
 ("Class & Daily","コーヒー+を ください","Coffee, please"),
 ("Class & Daily","みず+を ください","Water, please"),
 ("Class & Daily","にほんご+が すこし わかります","I understand a little Japanese"),
 ("Class & Daily","いま なんじ+ですか","What time is it now?"),
 ("IT & Work","パスワード+を にゅうりょく します","I enter the password"),
 ("IT & Work","ファイル+を ほぞん します","I save the file"),
 ("IT & Work","メール+を おくります","I send an email"),
 ("IT & Work","コンピューター+を つかいます","I use a computer"),
 ("IT & Work","インターネット+に つなぎます","I connect to the internet"),
 ("IT & Work","スマホ+を わすれました","I forgot my phone"),
 ("IT & Work","ログイン します","I log in"),
 ("IT & Work","ダウンロード します","I download it"),
]
HEAD = {"ごめんなさい":None,"おげんき":None,"おやすみなさい":None,"スマホ":None,
 "ただいま":"只今","また":"又","いま":"今","なんじ":"何時","おかえりなさい":"お帰りなさい","ごちそうさま":"御馳走様",
 "こんばんは":"今晩は","こんにちは":"今日は","おはよう":"御早う","ありがとう":"有り難う","ございます":"御座います",
 "すみません":"済みません","どういたしまして":"どう致しまして","はじめまして":"初めまして","ください":"下さい",
 "なん":"何","どこ":"何処","いくら":"幾ら","わたし":"私","がくせい":"学生","なまえ":"名前","みず":"水",
 "にほんご":"日本語","すこし":"少し","いちど":"一度","よろしく":"宜しく","おねがい":"お願い","さようなら":"左様なら",
 "あした":"明日","げんき":"元気","にゅうりょく":"入力","ほぞん":"保存","これ":"これ"}
NO_PITCH = {"サイヤッド"}   # user's own name: no dictionary entry
phr_rows, phr_notes, n_pclip = [], [], 0
for k, (theme, spec, en) in enumerate(PHR):
    chunks = []
    for ch in spec.split(" "):
        parts = ch.split("+")
        w, ptc = parts[0], "".join(parts[1:])
        n = len(moras(w))
        a, src = None, None
        if w in NO_PITCH:
            pass
        elif re.search(r"(ませんでした)$", w): pass
        elif w.endswith("ました") and n > 3: a, src = n - 2, "rule"
        elif (w.endswith("ます") or w.endswith("ません")) and n > 2:
            a, src = n - 1, "rule"
        else:
            hw = HEAD.get(w, w)
            s = None
            if hw is None: pass
            elif hw in acc:
                c = [x for (r, x) in acc[hw] if r in ("", w)]
                s = c[0] if c else None
            if s is None and hw is not None and hw == w and w in byreading and len(byreading[w]) == 1:
                s = next(iter(byreading[w]))
            if s is not None:
                m = re.search(r"\(感\)(\d+)", s)
                a, src = (int(m.group(1)) if m else first_acc(s)), "dict"
            else: phr_notes.append(("no-pitch", w))
        chunks.append(dict(w=w, p=ptc, a=a, src=src))
    audio = None
    if spec in CLIP_PHRASES:
        rd = CLIP_PHRASES[spec]
        cands = sorted(f for f in clips if f.endswith(f"【{rd}】.mp3"))
        phr_notes.append(("clipcands", spec, cands))
    phr_rows.append(dict(theme=theme, chunks=chunks, en=en, audio=audio,
                         q=spec.endswith("か")))

json.dump(dict(hira=hira_rows, kata=kata_rows, phr=phr_rows), open(os.path.join(OUTDIR, "data.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("hira", len(hira_rows), "with male clip", n_clip, "female->TTS", n_f)
print("kata", len(kata_rows), "dropped", kata_drops)
print("phr", len(phr_rows)); [print(n) for n in phr_notes]
