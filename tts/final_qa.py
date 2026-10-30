"""Check female VOICEVOX bundle clips, phrase timelines, and pitch agreement."""
import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vv_lib import f0_track, moras

DATA_PATH = os.path.join(ROOT, 'out', 'data.json')
BUNDLE_PATH = os.path.join(ROOT, 'out', 'audio', 'female_voice.mp3')
with open(DATA_PATH, encoding='utf-8') as file:
    DATA = json.load(file)
with open(BUNDLE_PATH, 'rb') as file:
    BUNDLE = file.read()


def clip_bytes(item):
    reference = item.get('ttsF')
    if not reference:
        raise ValueError(f"Missing female VOICEVOX reference for {item.get('kana', item.get('text', 'item'))}")
    start, length = int(reference['o']), int(reference['l'])
    clip = BUNDLE[start:start + length]
    if start < 0 or length <= 0 or len(clip) != length:
        raise ValueError(f"Invalid female VOICEVOX bundle range for {item.get('kana', item.get('text', 'item'))}")
    return clip


def duration(clip):
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', '-i', 'pipe:0'],
        input=clip,
        capture_output=True,
        check=True,
    )
    return float(result.stdout.decode('ascii').strip())


def decoded_clip(clip):
    result = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '24000', '-f', 's16le', '-'],
        input=clip,
        capture_output=True,
        check=True,
    )
    return np.frombuffer(result.stdout, np.int16).astype(float) / 32768, 24000


bad_timelines = 0
for index, phrase in enumerate(DATA['phr']):
    item_moras = len(moras(''.join(chunk['w'] + chunk['p'] for chunk in phrase['chunks'])))
    timeline = phrase.get('tlF', [])
    clip = clip_bytes(phrase)
    clip_duration = duration(clip)
    invalid_timeline = (
        len(timeline) != item_moras
        or any(not isinstance(value, (int, float)) or value < 0 or value > clip_duration for value in timeline)
        or timeline != sorted(timeline)
        or phrase.get('tendF', 0) > clip_duration
    )
    if invalid_timeline:
        bad_timelines += 1
        print('invalid female phrase timeline', index, len(timeline), item_moras, clip_duration)
print('female phrase timeline check: bad =', bad_timelines, 'of', len(DATA['phr']))


def pattern(size, accent):
    if accent == 0:
        return [0] + [1] * (size - 1)
    if accent == 1:
        return [1] + [0] * (size - 1)
    return [0] + [1] * (accent - 1) + [0] * (size - accent)


def agrees(item, size, accent):
    samples, sample_rate = decoded_clip(clip_bytes(item))
    track = f0_track(samples, sample_rate)
    voiced = [(time, frequency) for time, frequency in track if frequency]
    if len(voiced) < 6:
        return None
    start, end = voiced[0][0], voiced[-1][0]
    segment = (end - start) / size
    levels = []
    for index in range(size):
        values = [12 * np.log2(frequency) for time, frequency in voiced if start + index * segment <= time < start + (index + 1) * segment]
        levels.append(np.median(values) if values else np.nan)
    levels = np.array(levels)
    target = np.array(pattern(size, accent), dtype=float)
    if np.isnan(levels).any() or target.std() == 0:
        return None
    return int(np.corrcoef(target, levels)[0, 1] > 0.2)


for deck_name in ('hira', 'kata'):
    matching = total = 0
    for item in DATA[deck_name]:
        match = re.search(r'\d+', item.get('accent', ''))
        if not match:
            continue
        accent = int(match.group())
        size = len(moras(item['kana']))
        if size < 2 or (accent == size and accent > 1):
            continue
        result = agrees(item, size, accent)
        if result is not None:
            total += 1
            matching += result
    percent = round(100 * matching / total) if total else 0
    print(deck_name, 'female clips: pitch follows dictionary accent', matching, '/', total, '=', percent, '%')
