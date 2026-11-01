"""Build the beginner kanji deck from KANJIDIC2 and Kanjium source files."""
import gzip
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path


KANJI = tuple(
    "一七万三上下中九二五人今休先入八六円出分前北十千午半南友口古右名四"
    "国土外多大天女子学安小少山川左年店広後手新日時間書月木本来東校母"
    "毎気水火父生男白百目社空立耳聞自行西見言話語読買車週道金長雨電食飲高早"
)

WORDS = """
一人	ひとり	one person
二人	ふたり	two people
三人	さんにん	three people
一日	いちにち	one day
二日	ふつか	second day; two days
三日	みっか	third day; three days
六つ	むっつ	six
八つ	やっつ	eight
七つ	ななつ	seven
四つ	よっつ	four
五つ	いつつ	five
十日	とおか	tenth day; ten days
九つ	ここのつ	nine
今日	きょう	today
明日	あした	tomorrow
昨日	きのう	yesterday
毎日	まいにち	every day
今年	ことし	this year
来年	らいねん	next year
去年	きょねん	last year
今月	こんげつ	this month
来月	らいげつ	next month
先月	せんげつ	last month
毎月	まいつき	every month
毎週	まいしゅう	every week
今週	こんしゅう	this week
来週	らいしゅう	next week
先週	せんしゅう	last week
毎年	まいとし	every year
午前	ごぜん	morning; a.m.
午後	ごご	afternoon; p.m.
時間	じかん	time; hour
何時	なんじ	what time
何分	なんぷん	how many minutes
半分	はんぶん	half
月曜日	げつようび	Monday
火曜日	かようび	Tuesday
水曜日	すいようび	Wednesday
木曜日	もくようび	Thursday
金曜日	きんようび	Friday
土曜日	どようび	Saturday
日曜日	にちようび	Sunday
天気	てんき	weather
元気	げんき	healthy; energetic
電気	でんき	electricity; light
雨	あめ	rain
山	やま	mountain
川	かわ	river
火山	かざん	volcano
山道	やまみち	mountain path
田んぼ	たんぼ	rice paddy
空気	くうき	air
花火	はなび	fireworks
花見	はなみ	flower viewing
花屋	はなや	flower shop
学生	がくせい	student
先生	せんせい	teacher
学校	がっこう	school
大学	だいがく	university
大学生	だいがくせい	university student
小学校	しょうがっこう	elementary school
中学校	ちゅうがっこう	middle school
小学生	しょうがくせい	elementary school student
中学生	ちゅうがくせい	middle school student
入学	にゅうがく	entering a school
日本語	にほんご	Japanese language
国語	こくご	national language; Japanese class
英語	えいご	English language
外国	がいこく	foreign country
外国人	がいこくじん	foreigner
外国語	がいこくご	foreign language
読書	どくしょ	reading books
図書館	としょかん	library
電話	でんわ	telephone
電車	でんしゃ	train
自動車	じどうしゃ	car; automobile
駅前	えきまえ	in front of the station
入口	いりぐち	entrance
出口	でぐち	exit
行く	いく	to go
来る	くる	to come
見る	みる	to see; to look
見学	けんがく	study visit; tour
食事	しょくじ	meal
食べる	たべる	to eat
飲む	のむ	to drink
買い物	かいもの	shopping
話す	はなす	to speak
聞く	きく	to hear; to listen
読む	よむ	to read
書く	かく	to write
語学	ごがく	language study
大きい	おおきい	big
小さい	ちいさい	small
高い	たかい	high; expensive
長い	ながい	long
安い	やすい	inexpensive
古い	ふるい	old
多い	おおい	many
少ない	すくない	few
新しい	あたらしい	new
早い	はやい	early; fast
広い	ひろい	spacious; wide
上手	じょうず	good at
下手	へた	bad at
前	まえ	front; before
後ろ	うしろ	behind
上	うえ	above; up
下	した	below; down
中	なか	inside; middle
外	そと	outside
左	ひだり	left
右	みぎ	right
東	ひがし	east
西	にし	west
南	みなみ	south
北	きた	north
会社	かいしゃ	company
社会	しゃかい	society
店員	てんいん	store clerk
友達	ともだち	friend
名前	なまえ	name
父親	ちちおや	father
母親	ははおや	mother
男の子	おとこのこ	boy
女の子	おんなのこ	girl
子供	こども	child
人口	じんこう	population
国	くに	country
入る	はいる	to enter
出る	でる	to leave; to exit
休み	やすみ	day off; rest
白い	しろい	white
青い	あおい	blue
赤い	あかい	red
黒い	くろい	black
目	め	eye
口	くち	mouth
耳	みみ	ear
手	て	hand
足	あし	foot; leg
車	くるま	car
道	みち	road; way
道路	どうろ	road
間	あいだ	between; interval
空	そら	sky
本	ほん	book
本屋	ほんや	bookstore
本当	ほんとう	real; true
国名	こくめい	country name
有名	ゆうめい	famous
東京	とうきょう	Tokyo
京都	きょうと	Kyoto
西洋	せいよう	the West; Western countries
高校	こうこう	high school
高校生	こうこうせい	high school student
母	はは	mother
父	ちち	father
男	おとこ	man; male
女	おんな	woman; female
子	こ	child
生まれる	うまれる	to be born
生きる	いきる	to live
誕生日	たんじょうび	birthday
火事	かじ	fire; conflagration
水道	すいどう	water supply
土日	どにち	weekend
百	ひゃく	one hundred
千円	せんえん	one thousand yen
万年筆	まんねんひつ	fountain pen
何人	なんにん	how many people
何月	なんがつ	what month
何日	なんにち	what day; how many days
何年	なんねん	what year; how many years
何曜日	なんようび	what day of the week
立つ	たつ	to stand
言う	いう	to say
"""


def normalize(value):
    return unicodedata.normalize("NFKC", value)


def load_kanjidic(path):
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rb") as source:
        root = ET.parse(source).getroot()
    result = {}
    for character in root.findall("character"):
        literal = character.findtext("literal")
        if literal not in KANJI:
            continue
        group = character.find("reading_meaning/rmgroup")
        if group is None:
            raise ValueError(f"KANJIDIC2 has no reading group for {literal}")
        misc = character.find("misc")
        result[literal] = {
            "character": literal,
            "grade": misc.findtext("grade") if misc is not None else None,
            "on": list(dict.fromkeys(
                node.text for node in group.findall('reading[@r_type="ja_on"]') if node.text
            )),
            "kun": list(dict.fromkeys(
                node.text for node in group.findall('reading[@r_type="ja_kun"]') if node.text
            )),
            "meanings": list(dict.fromkeys(
                node.text for node in group.findall("meaning")
                if node.text and node.get("m_lang") is None
            )),
            "words": [],
        }
    missing = set(KANJI) - result.keys()
    if missing:
        raise ValueError(f"KANJIDIC2 is missing kanji: {''.join(sorted(missing))}")
    return result


def load_accents(path):
    accents = {}
    with Path(path).open(encoding="utf-8") as source:
        for line in source:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 3:
                continue
            pattern = [int(value) for value in re.findall(r"\d+", fields[2])]
            if pattern:
                key = (normalize(fields[0]), normalize(fields[1]))
                values = accents.setdefault(key, [])
                values.extend(value for value in pattern if value not in values)
    return accents


def build(kanjidic_path, accents_path):
    if len(set(KANJI)) != len(KANJI):
        raise ValueError("The curated N5 character list contains duplicates")
    kanji = load_kanjidic(kanjidic_path)
    accents = load_accents(accents_path)
    words = []
    seen = set()
    missing = []
    for line in WORDS.strip().splitlines():
        word, reading, meaning = line.split("\t")
        key = (normalize(word), normalize(reading))
        patterns = accents.get(key)
        if not patterns:
            missing.append(f"{word} ({reading})")
            continue
        identity = (word, reading)
        if identity in seen:
            continue
        seen.add(identity)
        words.append({
            "word": word,
            "reading": reading,
            "meaning": meaning,
            "accents": patterns,
        })
    if missing:
        raise ValueError(f"Kanjium accent entries not found: {', '.join(missing)}")
    for item in kanji.values():
        item["words"] = [word for word in words if item["character"] in word["word"]]
        if not item["on"] and not item["kun"]:
            raise ValueError(f"KANJIDIC2 has no Japanese readings for {item['character']}")
        if not item["meanings"]:
            raise ValueError(f"KANJIDIC2 has no English meaning for {item['character']}")
        if not item["words"]:
            raise ValueError(f"No Kanjium example word for {item['character']}")
    return {"kanji": [kanji[character] for character in KANJI], "words": words}


def main():
    if len(sys.argv) != 4:
        raise SystemExit(
            "usage: python build/kanji_deck.py <kanjidic2.xml[.gz]> <accents.txt> <output.json>"
        )
    output = Path(sys.argv[3])
    data = build(sys.argv[1], sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(data['kanji'])} kanji and {len(data['words'])} pitch-accented words to {output}")


if __name__ == "__main__":
    main()
