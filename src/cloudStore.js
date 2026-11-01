import { supabase } from './supabase.js';
import { normalizeStore } from './storage.js';

export async function readCloudStore(userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load cloud progress: ${error.message}`);
  return data ? normalizeStore(data.payload) : null;
}

export async function writeCloudStore(userId, payload) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(`Could not sync cloud progress: ${error.message}`);
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

  return {
    ...cloud,
    ...local,
    stats,
    sprints: [...new Map(
      [...(cloud.sprints || []), ...(local.sprints || [])]
        .map((sprint) => [`${sprint.t}:${sprint.key}`, sprint]),
    ).values()].slice(-40),
    conf: Object.fromEntries(
      [...new Set([...Object.keys(cloud.conf || {}), ...Object.keys(local.conf || {})])]
        .map((key) => [key, (cloud.conf?.[key] || 0) + (local.conf?.[key] || 0)]),
    ),
    prefs: { ...(cloud.prefs || {}), ...(local.prefs || {}) },
    customItems: [...customItems.values()],
    kanjiUnlockedGroups: [...new Set([
      ...(cloud.kanjiUnlockedGroups || []),
      ...(local.kanjiUnlockedGroups || []),
    ])],
  };
}
