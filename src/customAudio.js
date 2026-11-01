import { supabase } from './supabase.js';

// Keep the existing database name so saved custom recordings remain available.
const DATABASE = 'yomi-drill-custom-audio';
const STORE = 'clips';
let databasePromise;
let audioUserId = null;

export function setCustomAudioUser(userId) {
  audioUserId = userId;
}

function cloudAudioPath(userId, key) {
  return `${userId}/${encodeURIComponent(key)}`;
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Could not open custom audio storage: ${request.error?.message || 'unknown error'}`));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function writeClip(key, blob, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    operation(transaction.objectStore(STORE), key, blob);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`Could not save custom audio: ${transaction.error?.message || 'unknown error'}`));
    transaction.onabort = () => reject(new Error(`Custom audio storage was aborted: ${transaction.error?.message || 'unknown error'}`));
  });
}

export function saveCustomAudio(key, blob) {
  return (async () => {
    await writeClip(key, blob, (store, audioKey, audioBlob) => store.put(audioBlob, audioKey));
    if (audioUserId) {
      const { error } = await supabase.storage
        .from('custom-audio')
        .upload(cloudAudioPath(audioUserId, key), blob, { upsert: true, contentType: blob.type || 'audio/mpeg' });
      if (error) throw new Error(`Could not upload custom audio: ${error.message}`);
    }
  })();
}

export async function loadCustomAudio(key) {
  const database = await openDatabase();
  const localClip = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error(`Could not load custom audio: ${request.error?.message || 'unknown error'}`));
  });
  if (localClip || !audioUserId) return localClip;

  const { data, error } = await supabase.storage
    .from('custom-audio')
    .download(cloudAudioPath(audioUserId, key));
  if (error) throw new Error(`Could not download custom audio: ${error.message}`);
  await writeClip(key, data, (store, audioKey, audioBlob) => store.put(audioBlob, audioKey));
  return data;
}

export async function deleteCustomAudio(keys) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    keys.filter(Boolean).forEach((key) => store.delete(key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`Could not delete custom audio: ${transaction.error?.message || 'unknown error'}`));
    transaction.onabort = () => reject(new Error(`Custom audio deletion was aborted: ${transaction.error?.message || 'unknown error'}`));
  });
  if (audioUserId && keys.some(Boolean)) {
    const { error } = await supabase.storage
      .from('custom-audio')
      .remove(keys.filter(Boolean).map((key) => cloudAudioPath(audioUserId, key)));
    if (error) throw new Error(`Could not delete cloud audio: ${error.message}`);
  }
}

export async function uploadCustomAudio(keys) {
  for (const key of [...new Set(keys.filter(Boolean))]) {
    const clip = await loadCustomAudio(key);
    if (!clip) throw new Error(`Custom audio "${key}" is missing on this device and in cloud storage.`);
    const { error } = await supabase.storage
      .from('custom-audio')
      .upload(cloudAudioPath(audioUserId, key), clip, { upsert: true, contentType: clip.type || 'audio/mpeg' });
    if (error) throw new Error(`Could not transfer custom audio: ${error.message}`);
  }
}
