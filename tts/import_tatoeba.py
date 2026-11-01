"""Import reusable Tatoeba example sentences and licensed natural recordings."""
import bz2
import csv
import io
import json
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "out" / "kanji.json"
AUDIO_DIR = ROOT / "out" / "audio" / "tatoeba"
EXPORTS_URL = "https://downloads.tatoeba.org/exports/per_language/jpn/"
ENGLISH_EXPORTS_URL = "https://downloads.tatoeba.org/exports/per_language/eng/"
ALLOWED_AUDIO_LICENSES = {"CC BY 4.0", "CC BY-NC 4.0"}
USER_AGENT = "Yomi study app (https://github.com/syedaddan/yomi)"
ORIGINAL_SENTENCES = {
    "初夏": {
        "text": "初夏は気持ちのいい季節です。",
        "translation": "Early summer is a pleasant season.",
    },
    "突起": {
        "text": "この突起に気をつけてください。",
        "translation": "Please watch out for this protrusion.",
    },
}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def read_export_rows(url):
    compressed = io.BytesIO(fetch(url))
    with bz2.open(compressed, "rt", encoding="utf-8", newline="") as source:
        yield from csv.reader(source, delimiter="\t")


def load_exports():
    sentences = {}
    authors = {}
    for row in read_export_rows(EXPORTS_URL + "jpn_sentences_detailed.tsv.bz2"):
        if len(row) >= 4:
            sentence_id = int(row[0])
            sentences[sentence_id] = row[2]
            authors[sentence_id] = row[3] if row[3] not in {"", r"\N"} else None

    recordings = defaultdict(list)
    for row in read_export_rows(EXPORTS_URL + "jpn_sentences_with_audio.tsv.bz2"):
        if len(row) >= 5 and row[3] in ALLOWED_AUDIO_LICENSES:
            recordings[int(row[0])].append({
                "id": row[1],
                "license": row[3],
                "author": row[2] if row[2] not in {"", r"\N"} else None,
                "attribution_url": row[4],
            })
    for sentence_recordings in recordings.values():
        sentence_recordings.sort(key=lambda item: (
            item["license"] != "CC BY 4.0",
            int(item["id"]),
        ))

    translation_links = defaultdict(list)
    for row in read_export_rows(EXPORTS_URL + "jpn-eng_links.tsv.bz2"):
        if len(row) >= 2:
            translation_links[int(row[0])].append(int(row[1]))
    return sentences, authors, recordings, translation_links


def index_sentences(sentences, words):
    transitions = [{}]
    outputs = [[]]
    failures = [0]
    for word in words:
        state = 0
        for character in word:
            if character not in transitions[state]:
                transitions[state][character] = len(transitions)
                transitions.append({})
                outputs.append([])
                failures.append(0)
            state = transitions[state][character]
        outputs[state].append(word)

    queue = deque(transitions[0].values())
    while queue:
        state = queue.popleft()
        for character, child in transitions[state].items():
            queue.append(child)
            fallback = failures[state]
            while fallback and character not in transitions[fallback]:
                fallback = failures[fallback]
            failures[child] = transitions[fallback].get(character, 0)
            outputs[child].extend(outputs[failures[child]])

    indexed = defaultdict(list)
    for sentence_id, text in sentences.items():
        state = 0
        matched = set()
        for character in text:
            while state and character not in transitions[state]:
                state = failures[state]
            state = transitions[state].get(character, 0)
            for word in outputs[state]:
                if word not in matched:
                    indexed[word].append((sentence_id, text))
                    matched.add(word)
    return indexed


def select_sentence(candidates, recordings, translation_links):
    if not candidates:
        return None

    def rank(candidate):
        sentence_id, text = candidate
        license_rank = min(
            (
                0 if recording["license"] == "CC BY 4.0" else 1
                for recording in recordings.get(sentence_id, [])
            ),
            default=2,
        )
        return (
            license_rank,
            sentence_id not in translation_links,
            len(text),
            sentence_id,
        )
    return min(candidates, key=rank)


def load_translations(sentence_ids, translation_links):
    sentence_ids = set(sentence_ids)
    links = {
        sentence_id: translation_links[sentence_id]
        for sentence_id in sentence_ids
        if sentence_id in translation_links
    }
    english_ids = {english_id for ids in links.values() for english_id in ids}
    translations = {}
    if not english_ids:
        return {}

    for row in read_export_rows(ENGLISH_EXPORTS_URL + "eng_sentences_detailed.tsv.bz2"):
        if len(row) < 4:
            continue
        sentence_id = int(row[0])
        if sentence_id in english_ids:
            translations[sentence_id] = {
                "text": row[2],
                "owner": row[3] if row[3] not in {"", r"\N"} else None,
            }
            if len(translations) == len(english_ids):
                break

    selected = {}
    for sentence_id, english_sentence_ids in links.items():
        translation = next(
            (
                {
                    **translations[english_id],
                    "url": f"https://tatoeba.org/en/sentences/{english_id}",
                }
                for english_id in english_sentence_ids
                if english_id in translations
            ),
            None,
        )
        if translation:
            selected[sentence_id] = translation
    return selected


def download_recording(recording):
    recording_id = str(recording["id"])
    destination = AUDIO_DIR / f"{recording_id}.mp3"
    if destination.exists():
        return f"audio/tatoeba/{recording_id}.mp3"

    url = f"https://api.tatoeba.org/v1/audios/{urllib.parse.quote(recording_id)}/file"
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".mp3.tmp")
    temporary.write_bytes(fetch(url))
    temporary.replace(destination)
    return f"audio/tatoeba/{recording_id}.mp3"


def sentence_record(source, audio_paths):
    if source is None:
        return None
    translation = source["translation"]
    sentence_id = source["id"]
    record = {
        "text": source["text"],
        "sourceUrl": f"https://tatoeba.org/en/sentences/{sentence_id}",
        "source": {
            "provider": "Tatoeba",
            "id": sentence_id,
            "author": source["owner"],
            "license": "CC BY 2.0 FR",
        },
        "audio": {},
    }
    if translation:
        record["translation"] = translation["text"]
        record["translationAttribution"] = {
            "author": translation["owner"],
            "license": "CC BY 2.0 FR",
            "url": translation["url"],
        }
    recording = source["recording"]
    if recording:
        record["audio"].update({
            "audio": audio_paths[str(recording["id"])],
            "audioAttribution": {
                "author": recording.get("author"),
                "license": recording["license"],
                "url": recording.get("attribution_url")
                    or f"https://tatoeba.org/en/user/profile/{urllib.parse.quote(recording.get('author') or '')}",
            },
        })
    return record


def original_sentence(word):
    original = ORIGINAL_SENTENCES.get(word)
    if not original:
        return None
    return {
        **original,
        "source": {"provider": "Yomi", "author": "Yomi"},
        "audio": {},
    }


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    sentences, authors, recordings, translation_links = load_exports()
    words = sorted({word["word"] for entry in data["kanji"] for word in entry["words"]})
    candidate_index = index_sentences(sentences, words)
    selected = {}
    for index, word in enumerate(words, 1):
        selected[word] = select_sentence(
            candidate_index.get(word, []),
            recordings,
            translation_links,
        )
        if index % 50 == 0:
            print(f"Matched {index}/{len(words)} unique example words.", flush=True)

    selected_ids = {
        candidate[0] for candidate in selected.values() if candidate is not None
    }
    translations = load_translations(selected_ids, translation_links)
    recording_by_id = {}
    for sentence_id in selected_ids:
        if recordings[sentence_id]:
            recording = recordings[sentence_id][0]
            recording_by_id[str(recording["id"])] = recording
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(download_recording, recording): recording_id
            for recording_id, recording in recording_by_id.items()
        }
        audio_paths = {
            recording_id: future.result()
            for future, recording_id in futures.items()
        }

    sources = {}
    for word in words:
        candidate = selected[word]
        if candidate is None:
            sentence = original_sentence(word)
        else:
            sentence_id, text = candidate
            recording = recordings[sentence_id][0] if recordings[sentence_id] else None
            source = {
                "id": sentence_id,
                "text": text,
                "owner": authors.get(sentence_id),
                "translation": translations.get(sentence_id),
                "recording": recording,
            }
            sentence = sentence_record(source, audio_paths)
        if sentence is None:
            raise ValueError(f"No approved Tatoeba sentence or authored fallback for {word}")
        sources[word] = sentence

    for entry in data["kanji"]:
        for word in entry["words"]:
            sentence = sources[word["word"]]
            previous = word.get("sentence")
            if previous and previous.get("text") == sentence["text"]:
                audio = previous.get("audio", {}).get("ttsF")
                if audio:
                    sentence["audio"]["ttsF"] = audio
            word["sentence"] = sentence

    temporary = DATA_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(DATA_PATH)
    natural = {
        word["sentence"]["audio"]["audio"]
        for entry in data["kanji"]
        for word in entry["words"]
        if word["sentence"]["audio"].get("audio")
    }
    print(
        f"Imported {len(words)} unique sentences across "
        f"{sum(len(entry['words']) for entry in data['kanji'])} associations; "
        f"{len(natural)} distinct licensed natural recordings."
    )


if __name__ == "__main__":
    main()
