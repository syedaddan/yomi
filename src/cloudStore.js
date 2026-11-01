import { supabase } from './supabase.js';
import { emptyStore, normalizeStore } from './storage.js';

const TABLES = [
  'user_preferences',
  'user_item_progress',
  'user_lookalike_progress',
  'user_confusion_pairs',
  'user_sprint_sessions',
  'user_custom_words',
  'user_kanji_progress',
];

function throwOnError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

function schemaNotInstalled(error) {
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code);
}

async function readLegacyStore(userId) {
  const result = await supabase
    .from('user_data')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) throw new Error(`Could not load cloud progress: ${result.error.message}`);
  return result.data ? normalizeStore(result.data.payload) : null;
}

export function progressFromRows(rows) {
  const store = emptyStore();
  const [preferences, itemRows, lookalikeRows, pairRows, sprintRows, wordRows, kanjiRows] = rows;
  store.prefs = preferences?.preferences || {};
  for (const row of itemRows || []) {
    store.stats[row.item_id] = {
      n: row.attempts,
      got: row.got,
      slow: row.slow,
      miss: row.missed,
      ms: row.response_times || [],
    };
  }
  for (const row of lookalikeRows || []) {
    store.conf[row.glyph] = {
      n: row.attempts,
      miss: row.missed,
      rt: row.response_times || [],
    };
  }
  for (const row of pairRows || []) store.conf[`pair:${row.pair}`] = row.misses;
  store.sprints = (sprintRows || [])
    .map((row) => ({
      t: Number(row.started_at_ms),
      key: row.deck_key,
      read: row.cards_read,
      miss: row.misses,
      mpm: row.mora_per_minute,
    }))
    .sort((a, b) => a.t - b.t)
    .slice(-40);
  store.customItems = (wordRows || []).map((row) => ({
    id: row.item_id,
    deck: row.deck,
    kana: row.kana,
    en: row.meaning,
    theme: row.theme,
    accent: row.accent,
    sourceUrl: row.source_url,
    humanAudioUrl: row.human_audio_url,
    humanAudioId: row.human_audio_id,
    femaleAudioId: row.female_audio_id || '',
    audio: null,
    alt: null,
    ttsF: null,
  }));
  for (const row of kanjiRows || []) {
    store.kanjiProgress[row.character] = {
      groupId: row.group_id,
      views: row.views,
      reveals: row.reveals,
      n: row.attempts,
      got: row.got,
      slow: row.slow,
      miss: row.missed,
      lastReviewedAt: row.last_reviewed_at,
    };
  }
  return normalizeStore(store);
}

export async function readCloudStore(userId) {
  const results = await Promise.all(TABLES.map((table) => (
    supabase.from(table).select('*').eq('user_id', userId)
  )));
  const missingSchema = results.find((result) => schemaNotInstalled(result.error));
  if (missingSchema) {
    console.warn('Structured progress migration is not installed yet; reading legacy cloud progress.');
    return readLegacyStore(userId);
  }
  const rows = results.map((result, index) => throwOnError(result, `Could not load ${TABLES[index]}`));
  const hasData = rows.some((tableRows) => tableRows.length > 0);
  return hasData ? progressFromRows(rows) : null;
}

export async function writeCloudStore(_userId, payload) {
  const { error } = await supabase.rpc('sync_user_progress', {
    p_payload: normalizeStore(payload),
  });
  if (!error) return;
  if (!schemaNotInstalled(error)) throw new Error(`Could not sync cloud progress: ${error.message}`);
  console.warn('Structured progress migration is not installed yet; writing legacy cloud progress.');
  const legacyResult = await supabase
    .from('user_data')
    .upsert({
      user_id: _userId,
      payload: normalizeStore(payload),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (legacyResult.error) throw new Error(`Could not sync cloud progress: ${legacyResult.error.message}`);
}

export function mergeStores(local, cloud) {
  const stats = { ...cloud.stats };
  for (const [id, localStat] of Object.entries(local.stats)) {
    const cloudStat = stats[id];
    if (!cloudStat) {
      stats[id] = localStat;
    } else {
      stats[id] = {
        ...cloudStat,
        n: (cloudStat.n || 0) + (localStat.n || 0),
        got: (cloudStat.got || 0) + (localStat.got || 0),
        slow: (cloudStat.slow || 0) + (localStat.slow || 0),
        miss: (cloudStat.miss || 0) + (localStat.miss || 0),
        ms: [...new Set([...(cloudStat.ms || []), ...(localStat.ms || [])])].slice(-6),
      };
    }
  }

  const customItems = new Map((cloud.customItems || []).map((item) => [item.id, item]));
  for (const item of local.customItems || []) {
    if (!customItems.has(item.id)) customItems.set(item.id, item);
  }

  const kanjiProgress = { ...(cloud.kanjiProgress || {}) };
  for (const [character, localProgress] of Object.entries(local.kanjiProgress || {})) {
    const cloudProgress = kanjiProgress[character];
    kanjiProgress[character] = cloudProgress
      ? {
        ...cloudProgress,
        ...localProgress,
        views: (cloudProgress.views || 0) + (localProgress.views || 0),
        reveals: (cloudProgress.reveals || 0) + (localProgress.reveals || 0),
        n: (cloudProgress.n || 0) + (localProgress.n || 0),
        got: (cloudProgress.got || 0) + (localProgress.got || 0),
        slow: (cloudProgress.slow || 0) + (localProgress.slow || 0),
        miss: (cloudProgress.miss || 0) + (localProgress.miss || 0),
        lastReviewedAt: [cloudProgress.lastReviewedAt, localProgress.lastReviewedAt]
          .filter(Boolean).sort().at(-1) || null,
      }
      : localProgress;
  }

  return {
    ...cloud,
    ...local,
    stats,
    sprints: [...new Map(
      [...(cloud.sprints || []), ...(local.sprints || [])]
        .map((sprint) => [`${sprint.t}:${sprint.key}`, sprint]),
    ).values()].slice(-40),
    conf: Object.fromEntries([...new Set([
      ...Object.keys(cloud.conf || {}),
      ...Object.keys(local.conf || {}),
    ])].map((key) => {
      const localValue = local.conf?.[key];
      const cloudValue = cloud.conf?.[key];
      if (key.startsWith('pair:')) return [key, (cloudValue || 0) + (localValue || 0)];
      const localStats = localValue || {};
      const cloudStats = cloudValue || {};
      return [key, {
        ...cloudStats,
        ...localStats,
        n: (cloudStats.n || 0) + (localStats.n || 0),
        miss: (cloudStats.miss || 0) + (localStats.miss || 0),
        rt: [...new Set([...(localStats.rt || []), ...(cloudStats.rt || [])])].slice(-8),
      }];
    })),
    prefs: { ...(cloud.prefs || {}), ...(local.prefs || {}) },
    customItems: [...customItems.values()],
    kanjiProgress,
  };
}
