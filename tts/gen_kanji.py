"""Generate VOICEVOX clips for Kanji, all listed readings, and example sentences."""
import json
import os
import re
import shutil
import subprocess
import sys
import io
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vv_lib import synth

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "out" / "kanji.json"
AUDIO_PATH = ROOT / "out" / "audio" / "kanji_voice.mp3"
VOICE = 16


def ffmpeg_path():
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    try:
        import imageio_ffmpeg
    except ImportError as error:
        raise RuntimeError("Install FFmpeg or the imageio-ffmpeg Python package to encode clips.") from error
    return imageio_ffmpeg.get_ffmpeg_exe()


def encode_mp3(samples, sample_rate):
    samples = np.asarray(samples, dtype=float)
    peak = np.max(np.abs(samples))
    if peak:
        samples = samples / peak * 0.7
    wav = io.BytesIO()
    sf.write(wav, samples, sample_rate, format="WAV")
    result = subprocess.run(
        [
            ffmpeg_path(), "-v", "error", "-f", "wav", "-i", "pipe:0",
            "-ac", "1", "-ar", "24000", "-b:a", "48k", "-f", "mp3", "pipe:1",
        ],
        input=wav.getvalue(),
        capture_output=True,
        check=True,
    )
    return result.stdout


def generate_clip(text, kana_mode):
    samples, sample_rate, _ = synth(text, VOICE, kana_mode=kana_mode)
    return encode_mp3(samples, sample_rate)


def reading_text(reading):
    return re.sub(r"[.-]", "", reading)


def generate():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    jobs = {}
    bindings = []

    for entry in data["kanji"]:
        readings = [*entry["on"], *entry["kun"]]
        if not readings:
            raise ValueError(f"No reading available for {entry['character']}")

        entry_audio = entry.setdefault("audio", {})
        character_audio = entry_audio.setdefault("character", {})
        character_text = reading_text(readings[0])
        character_key = (character_text, True)
        jobs.setdefault(character_key, None)
        bindings.append((character_audio, character_key))

        reading_audio = entry_audio.setdefault("readings", {})
        for reading in dict.fromkeys(readings):
            item = reading_audio.setdefault(reading, {})
            reading_key = (reading_text(reading), True)
            jobs.setdefault(reading_key, None)
            bindings.append((item, reading_key))

        for word in entry["words"]:
            sentence = word.get("sentence")
            if not sentence or not sentence.get("text"):
                raise ValueError(f"Missing example sentence for {entry['character']} / {word['word']}")
            sentence_audio = sentence.setdefault("audio", {})
            sentence_key = (sentence["text"], False)
            jobs.setdefault(sentence_key, None)
            bindings.append((sentence_audio, sentence_key))

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(generate_clip, *key): key
            for key in jobs
        }
        clips = {}
        for index, future in enumerate(as_completed(futures), 1):
            clips[futures[future]] = future.result()
            if index % 25 == 0:
                print(f"Synthesized {index}/{len(jobs)} unique Kanji clips.", flush=True)

    audio = bytearray()
    offsets = {}
    for key in jobs:
        clip = clips[key]
        offsets[key] = (len(audio), len(clip))
        audio.extend(clip)
    for item, key in bindings:
        offset, length = offsets[key]
        item["ttsF"] = {
            "file": "audio/kanji_voice.mp3",
            "o": offset,
            "l": length,
        }

    AUDIO_PATH.parent.mkdir(parents=True, exist_ok=True)
    audio_tmp = AUDIO_PATH.with_suffix(".mp3.tmp")
    data_tmp = DATA_PATH.with_suffix(".json.tmp")
    audio_tmp.write_bytes(audio)
    data_tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audio_tmp.replace(AUDIO_PATH)
    data_tmp.replace(DATA_PATH)
    print(
        f"Wrote {len(bindings)} Kanji voice clips using {len(jobs)} unique "
        f"syntheses ({len(audio)} bytes)."
    )


if __name__ == "__main__":
    generate()
