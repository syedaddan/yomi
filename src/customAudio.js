// Keep the existing database name so saved custom recordings remain available.
const DATABASE = 'yomi-drill-custom-audio';
const STORE = 'clips';
let databasePromise;

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
  return writeClip(key, blob, (store, audioKey, audioBlob) => store.put(audioBlob, audioKey));
}

export async function loadCustomAudio(key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error(`Could not load custom audio: ${request.error?.message || 'unknown error'}`));
  });
}

export async function deleteCustomAudio(keys) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    keys.filter(Boolean).forEach((key) => store.delete(key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`Could not delete custom audio: ${transaction.error?.message || 'unknown error'}`));
    transaction.onabort = () => reject(new Error(`Custom audio deletion was aborted: ${transaction.error?.message || 'unknown error'}`));
  });
}
