import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeFemaleWord } from './voicevox.js';

function response(data, contentType = 'application/json') {
  return new Response(data, { status: 200, headers: { 'Content-Type': contentType } });
}

test('synthesizes female audio with the requested Kanjium accent', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/audio_query')) {
      return response(JSON.stringify({
        accent_phrases: [{ moras: Array.from({ length: 7 }, (_, index) => ({ text: `m${index}` })), accent: 2 }],
      }));
    }
    if (String(url).includes('/mora_data')) {
      const body = JSON.parse(options.body);
      assert.equal(body[0].moras.length, 7);
      assert.equal(body[0].accent, 7);
      return response(JSON.stringify([{ ...body[0], accent: 7 }]));
    }
    assert.match(String(url), /\/synthesis\?speaker=16$/);
    return response(new Blob(['wave'], { type: 'audio/wav' }), 'audio/wav');
  };
  try {
    const audio = await synthesizeFemaleWord('コロナウイルス', 0);
    assert.equal(audio.type, 'audio/wav');
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /speaker=16/);
    assert.match(calls[0].url, /is_kana=true/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('preserves VOICEVOX default accent when the pitch is unknown', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/audio_query')) {
      return response(JSON.stringify({ accent_phrases: [{ moras: [{ text: 'コ' }], accent: 1 }] }));
    }
    return response(new Blob(['wave'], { type: 'audio/wav' }), 'audio/wav');
  };
  try {
    const audio = await synthesizeFemaleWord('コ', null);
    assert.equal(audio.type, 'audio/wav');
    assert.equal(calls.some((url) => url.includes('/mora_data')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('explains when the local VOICEVOX Engine is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  try {
    await assert.rejects(synthesizeFemaleWord('コ', null), /local VOICEVOX Engine.*CORS enabled/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
