import React, { useEffect, useRef, useState } from 'react';
import Drill from './components/Drill.jsx';
import Pacer from './components/Pacer.jsx';
import AddWords from './components/AddWords.jsx';
import KanjiDeck from './components/KanjiDeck.jsx';
import AccountPage from './components/AccountPage.jsx';
import DeckAdmin from './components/DeckAdmin.jsx';
import { LookalikeTab, ProgressTab } from './components/StudyTabs.jsx';
import { InfoButton, SectionNav, Toast } from './components/shared.jsx';
import AccountPanel from './components/AccountPanel.jsx';
import SettingsBar from './components/SettingsBar.jsx';
import kanjiDeck from '../out/kanji.json';
import { ITEMS } from './data.js';
import { applyDeckOverrides } from './deckCatalog.js';
import { readDeckCatalog, removeDeckCatalogItem, saveDeckCatalogItem } from './deckStore.js';
import {
  publishNextKanjiLesson as publishNextKanjiLessonRemote,
  readKanjiAvailability,
  readOwnProfile,
  removeOwnAvatar,
  saveOwnProfile,
  uploadOwnAvatar,
} from './accountStore.js';
import { mergeStores, readCloudStore, writeCloudStore } from './cloudStore.js';
import { deleteCustomAudio, setCustomAudioUser, uploadCustomAudio } from './customAudio.js';
import { supabase, supabaseConfigured } from './supabase.js';
import {
  DEFAULT_PREFS,
  emptyStore,
  hasStoredStore,
  loadStore,
  normalizeStore,
  preferencesFrom,
  saveStore,
  userStorageKey,
} from './storage.js';

const pages = ['drill', 'kanji', 'pacer', 'alike', 'progress', 'add', 'decks', 'account'];
const pagesWithSettings = new Set(['drill', 'kanji', 'pacer', 'alike']);

const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');

function pagePath(page) {
  const root = basePath ? `${basePath}/` : '/';
  return page === 'drill' ? root : `${root}${page}`;
}

function pageFromLocation() {
  const legacyHash = window.location.hash.replace(/^#\/?/, '');
  if (pages.includes(legacyHash)) return legacyHash;

  let route = window.location.pathname;
  if (basePath && (route === basePath || route.startsWith(`${basePath}/`))) {
    route = route.slice(basePath.length);
  }
  route = route.replace(/^\/+|\/+$/g, '');
  return pages.includes(route) ? route : 'drill';
}

function initialState() {
  const store = loadStore();
  return { store, prefs: preferencesFrom(store) };
}

function hasSavedData(store) {
  return Boolean(
    Object.keys(store.stats).length
    || store.sprints.length
    || Object.keys(store.conf).length
    || Object.keys(store.prefs).length
    || store.customItems.length
    || Object.keys(store.kanjiProgress || {}).length
    || store.kanjiUnlockedGroups?.length,
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value);
}

function customAudioKeys(store) {
  return (store.customItems || []).flatMap((item) => [item.femaleAudioId, item.humanAudioId]).filter(Boolean);
}

export default function App() {
  const [initial] = useState(initialState);
  const [store, setStore] = useState(initial.store);
  const storeRef = useRef(store);
  const [prefs, setPrefs] = useState(initial.prefs);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(pageFromLocation);
  const [resetVersion, setResetVersion] = useState(0);
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [syncStatus, setSyncStatus] = useState(supabaseConfigured ? 'signed-out' : 'unconfigured');
  const [syncError, setSyncError] = useState('');
  const [pendingCloudStore, setPendingCloudStore] = useState(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [deckItems, setDeckItems] = useState(ITEMS);
  const [deckCatalogError, setDeckCatalogError] = useState('');
  const [kanjiUnlockedCount, setKanjiUnlockedCount] = useState(1);
  const [adminNotice, setAdminNotice] = useState(false);
  const cloudUserId = useRef(null);
  const profileUserId = useRef(null);
  const cloudWriteQueue = useRef(Promise.resolve());

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    let active = true;
    async function refreshDeckCatalog() {
      try {
        const items = await readDeckCatalog();
        if (active) {
          setDeckItems(items);
          setDeckCatalogError('');
        }
      } catch (error) {
        if (active) setDeckCatalogError(error instanceof Error ? error.message : 'Could not load the shared decks.');
      }
    }
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refreshDeckCatalog();
    }
    refreshDeckCatalog();
    const timer = window.setInterval(refreshDeckCatalog, 30000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    let authEventSeen = false;

    async function loadUserStore(session) {
      if (!active) return;
      const userId = session?.user?.id;
      setAuthSession(session);
      setAuthReady(true);
      setCustomAudioUser(userId || null);
      if (!userId) {
        cloudUserId.current = null;
        profileUserId.current = null;
        setProfile(null);
        setProfileLoading(false);
        setProfileError('');
        const local = loadStore();
        setStore(local);
        setPrefs(preferencesFrom(local));
        setPendingCloudStore(null);
        setMigrationRequired(false);
        setSyncStatus('signed-out');
        return;
      }
      profileUserId.current = userId;
      setProfileLoading(true);
      setProfileError('');
      readOwnProfile(userId)
        .then((nextProfile) => {
          if (active && profileUserId.current === userId) setProfile(nextProfile);
        })
        .catch((error) => {
          if (active && profileUserId.current === userId) {
            setProfileError(error instanceof Error ? error.message : 'Could not load your profile.');
          }
        })
        .finally(() => {
          if (active && profileUserId.current === userId) setProfileLoading(false);
        });
      if (cloudUserId.current === userId) return;
      const previousUserId = cloudUserId.current;
      cloudUserId.current = userId;
      setSyncStatus('loading');
      setSyncError('');
      try {
        const remote = await readCloudStore(userId);
        if (!active || cloudUserId.current !== userId) return;
        const localKey = userStorageKey(userId);
        const local = hasStoredStore(localKey)
          ? loadStore(localKey)
          : previousUserId ? loadStore() : normalizeStore(storeRef.current);
        if (remote && stableStringify(local) === stableStringify(remote)) {
          setStore(remote);
          setPrefs(preferencesFrom(remote));
          setSyncStatus('ready');
          return;
        }
        if (remote && !hasSavedData(local)) {
          saveStore(remote, localKey);
          setStore(remote);
          setPrefs(preferencesFrom(remote));
          setSyncStatus('ready');
          return;
        }
        if (remote || hasSavedData(local)) {
          setPendingCloudStore(remote);
          setMigrationRequired(true);
          setSyncStatus('choice');
          return;
        }
        const fresh = emptyStore();
        await writeCloudStore(userId, fresh);
        if (!active || cloudUserId.current !== userId) return;
        saveStore(fresh, localKey);
        setStore(fresh);
        setPrefs(preferencesFrom(fresh));
        setSyncStatus('ready');
      } catch (error) {
        if (!active || cloudUserId.current !== userId) return;
        cloudUserId.current = null;
        setSyncError(error instanceof Error ? error.message : 'Could not load cloud progress.');
        setSyncStatus('error');
      }
    }

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (authEventSeen) return;
        if (error) {
          setSyncError(error.message);
          setSyncStatus('error');
          setAuthReady(true);
          return;
        }
        loadUserStore(data.session);
      })
      .catch((error) => {
        if (authEventSeen) return;
        setSyncError(error instanceof Error ? error.message : 'Could not check your account session.');
        setSyncStatus('error');
        setAuthReady(true);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      window.setTimeout(() => loadUserStore(session), 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    let hasReportedError = false;
    async function refreshAvailability() {
      try {
        const count = await readKanjiAvailability();
        if (active) setKanjiUnlockedCount(Math.min(count, kanjiDeck.groups.length));
      } catch (error) {
        if (active && !hasReportedError) {
          hasReportedError = true;
          setToast(error instanceof Error ? error.message : 'Could not load Kanji lesson availability.');
        }
      }
    }
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refreshAvailability();
    }
    refreshAvailability();
    const timer = window.setInterval(refreshAvailability, 30000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  function navigate(nextPage, replace = false) {
    const url = `${pagePath(nextPage)}${window.location.search}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setPage(nextPage);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    function onLocationChange() {
      const nextPage = pageFromLocation();
      const nextPath = pagePath(nextPage);
      if (window.location.hash || window.location.pathname !== nextPath) {
        window.history.replaceState(null, '', `${nextPath}${window.location.search}`);
      }
      setPage(nextPage);
      window.scrollTo(0, 0);
    }
    onLocationChange();
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);

  useEffect(() => {
    if (page !== 'decks' || !authReady) return;
    const userId = authSession?.user?.id;
    if (userId && (profileLoading || profileUserId.current !== userId)) return;
    if (profile?.is_admin) return;
    window.history.replaceState(null, '', `${pagePath('drill')}${window.location.search}`);
    setPage('drill');
  }, [page, authReady, authSession?.user?.id, profileLoading, profile?.is_admin]);

  useEffect(() => {
    const label = { drill: 'Drill', pacer: 'Phrase pacer', alike: 'Look-alikes', progress: 'Progress', kanji: 'Kanji', add: 'Add words', decks: 'Decks', account: 'Account' }[page];
    document.title = `${label} · Yomi`;
  }, [page]);

  useEffect(() => {
    document.body.classList.toggle('no-settings-dock', !pagesWithSettings.has(page));
    return () => document.body.classList.remove('no-settings-dock');
  }, [page]);

  useEffect(() => {
    if (authSession?.user?.id && syncStatus !== 'ready') return undefined;
    const key = authSession?.user?.id ? userStorageKey(authSession.user.id) : undefined;
    const timer = window.setTimeout(() => saveStore(store, key), 250);
    return () => window.clearTimeout(timer);
  }, [store, authSession?.user?.id, syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'ready' || !authSession?.user?.id) return undefined;
    const userId = authSession.user.id;
    const timer = window.setTimeout(() => {
      if (cloudUserId.current !== userId) return;
      const write = cloudWriteQueue.current.then(async () => {
        if (cloudUserId.current === userId) await writeCloudStore(userId, store);
      });
      cloudWriteQueue.current = write.catch(() => {});
      write.then(() => {
        if (cloudUserId.current === userId) {
          setSyncError('');
          setSyncStatus('ready');
        }
      }).catch((error) => {
        if (cloudUserId.current === userId) {
          setSyncError(error instanceof Error ? error.message : 'Could not sync cloud progress.');
          setSyncStatus('error');
        }
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [store, authSession?.user?.id, syncStatus]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message) {
    setToast(message);
  }

  async function saveProfile(changes) {
    const userId = authSession?.user?.id;
    if (!userId) throw new Error('Sign in to edit your profile.');
    const nextProfile = await saveOwnProfile(userId, changes);
    setProfile(nextProfile);
  }

  async function uploadAvatar(file) {
    const userId = authSession?.user?.id;
    if (!userId) throw new Error('Sign in to change your profile picture.');
    const nextProfile = await uploadOwnAvatar(userId, file);
    setProfile(nextProfile);
  }

  async function removeAvatar() {
    const userId = authSession?.user?.id;
    if (!userId) throw new Error('Sign in to change your profile picture.');
    const result = await removeOwnAvatar(userId);
    setProfile(result.profile);
    if (result.warning) throw new Error(result.warning);
  }

  async function setAccountPassword(password) {
    if (!supabase) throw new Error('Account sign-in is not configured.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(`Could not update your password: ${error.message}`);
  }

  async function signOutAccount() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
    navigate('drill', true);
  }

  async function deleteAccount() {
    const userId = authSession?.user?.id;
    if (!userId || !supabase) throw new Error('Sign in to delete your account.');
    const audioKeys = customAudioKeys(store);
    if (audioKeys.length) await deleteCustomAudio(audioKeys);
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error(`Could not delete your account: ${error.message}`);
    let cacheWarning = '';
    try {
      localStorage.removeItem(userStorageKey(userId));
    } catch (error) {
      cacheWarning = error instanceof Error ? error.message : 'Could not remove this browser’s account cache.';
    }
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw new Error(`Your account was deleted, but sign-out failed: ${signOutError.message}`);
    navigate('drill', true);
    notify(cacheWarning
      ? `Account deleted, but this browser’s saved copy could not be removed: ${cacheWarning}`
      : 'Your account and associated data were deleted.');
  }

  function persistStore(nextStore) {
    const userId = authSession?.user?.id;
    return saveStore(nextStore, userId ? userStorageKey(userId) : undefined);
  }

  async function completeMigration(nextStore) {
    const userId = authSession?.user?.id;
    if (!userId) return;
    setSyncStatus('loading');
    setSyncError('');
    try {
      setCustomAudioUser(userId);
      await uploadCustomAudio(customAudioKeys(nextStore));
      await writeCloudStore(userId, nextStore);
      saveStore(nextStore, userStorageKey(userId));
      setStore(nextStore);
      setPrefs(preferencesFrom(nextStore));
      setPendingCloudStore(null);
      setMigrationRequired(false);
      setSyncStatus('ready');
      notify('Progress synced to your account.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not transfer this device’s data.');
      setSyncStatus('error');
    }
  }

  function importLocalData() {
    const merged = pendingCloudStore ? mergeStores(store, pendingCloudStore) : normalizeStore(store);
    return completeMigration(merged);
  }

  async function useCloudData() {
    const userId = authSession?.user?.id;
    if (!userId) return;
    const nextStore = pendingCloudStore || emptyStore();
    setSyncStatus('loading');
    setSyncError('');
    try {
      await writeCloudStore(userId, nextStore);
      saveStore(nextStore, userStorageKey(userId));
      setStore(nextStore);
      setPrefs(preferencesFrom(nextStore));
      setPendingCloudStore(null);
      setMigrationRequired(false);
      setSyncStatus('ready');
      notify('Cloud progress loaded on this device.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not load cloud progress.');
      setSyncStatus('error');
    }
  }

  function retryCloudSync() {
    const userId = authSession?.user?.id;
    if (!userId) return;
    setSyncStatus('loading');
    setSyncError('');
    if (migrationRequired) {
      setSyncStatus('choice');
      return;
    }
    readCloudStore(userId)
      .then((remote) => {
        if (cloudUserId.current !== userId) return;
        if (remote) {
          setPendingCloudStore(remote);
          setMigrationRequired(true);
          setSyncStatus('choice');
        } else {
          setSyncStatus('ready');
        }
      })
      .catch((error) => {
        if (cloudUserId.current !== userId) return;
        setSyncError(error instanceof Error ? error.message : 'Could not reload cloud progress.');
        setSyncStatus('error');
      });
  }

  function setPreference(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setStore((current) => ({ ...current, prefs: { ...current.prefs, [key]: value } }));
  }

  function resetSection(section) {
    const defaults = DEFAULT_PREFS;
    const resetValues = {
      display: { romaji: defaults.romaji, marks: defaults.marks, furigana: defaults.furigana, mode: defaults.mode },
      decks: { decks: { ...defaults.decks } },
      themes: { themes: [] },
      reading: { mode: defaults.mode, flashMs: defaults.flashMs, chunk: defaults.chunk },
      phrases: { paceTheme: defaults.paceTheme, pacePhraseId: defaults.pacePhraseId },
      pace: { paceRate: defaults.paceRate, paceChunk: defaults.paceChunk, paceSpeak: defaults.paceSpeak },
      script: { alikeScript: defaults.alikeScript },
    }[section];
    if (!resetValues) return;
    setPrefs((current) => ({ ...current, ...resetValues }));
    setStore((current) => ({ ...current, prefs: { ...current.prefs, ...resetValues } }));
    notify(`${section[0].toUpperCase()}${section.slice(1)} settings reset.`);
  }

  function resetAll() {
    const defaults = { ...DEFAULT_PREFS, decks: { ...DEFAULT_PREFS.decks }, themes: [] };
    setPrefs(defaults);
    setStore((current) => ({ ...current, prefs: defaults }));
    setResetVersion((version) => version + 1);
    notify('All settings reset.');
  }

  function addCustomItem(item) {
    const nextPrefs = {
      ...prefs,
      decks: { ...prefs.decks, [item.deck]: true },
      themes: prefs.themes.length
        ? [...new Set([...prefs.themes, `${item.deck}|${item.theme}`])]
        : prefs.themes,
    };
    const nextStore = {
      ...store,
      prefs: { ...store.prefs, ...nextPrefs },
      customItems: [...(store.customItems || []), item],
    };
    if (!persistStore(nextStore)) throw new Error('Could not save this word in browser storage.');
    setStore(nextStore);
    setPrefs(nextPrefs);
    setResetVersion((version) => version + 1);
    navigate('drill');
  }

  function deleteCustomItem(id) {
    const nextStore = { ...store, customItems: store.customItems.filter((item) => item.id !== id) };
    if (!persistStore(nextStore)) throw new Error('Could not update your saved word list.');
    setStore(nextStore);
  }

  async function saveDeckItem(item) {
    if (!profile?.is_admin) throw new Error('Only the Yomi admin can change shared decks.');
    const override = await saveDeckCatalogItem(item);
    setDeckItems((current) => applyDeckOverrides(current, [override]));
    setResetVersion((version) => version + 1);
  }

  async function deleteDeckItem(id) {
    if (!profile?.is_admin) throw new Error('Only the Yomi admin can change shared decks.');
    const isOriginal = ITEMS.some((item) => item.id === id);
    const override = await removeDeckCatalogItem(id, isOriginal);
    setDeckItems((current) => applyDeckOverrides(current, [override]));
    setResetVersion((version) => version + 1);
  }

  async function publishNextKanjiLesson() {
    if (!profile?.is_admin) {
      setAdminNotice(true);
      return false;
    }
    if (!supabase || kanjiUnlockedCount >= kanjiDeck.groups.length) return false;
    try {
      const count = await publishNextKanjiLessonRemote(kanjiUnlockedCount);
      setKanjiUnlockedCount(Math.min(count, kanjiDeck.groups.length));
      notify('The next Kanji lesson is now available to everyone.');
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not unlock the next Kanji lesson.');
      return false;
    }
  }

  function recordKanjiProgress(character, groupId, field, rating) {
    setStore((current) => {
      const previous = current.kanjiProgress?.[character] || {
        groupId, views: 0, reveals: 0, n: 0, got: 0, slow: 0, miss: 0,
      };
      const next = { ...previous, groupId };
      if (field === 'rating' && rating) {
        next.n += 1;
        next[rating] += 1;
        next.lastReviewedAt = new Date().toISOString();
      } else next[field] = (previous[field] || 0) + 1;
      return {
        ...current,
        kanjiProgress: { ...current.kanjiProgress, [character]: next },
      };
    });
  }

  return (
    <>
      <div className={`wrap${prefs.romaji ? '' : ' no-rom'}${prefs.marks ? '' : ' no-mark'}`} id="app">
        <header className="top">
          <div className="top-in">
            <AccountPanel
              user={authSession?.user || null}
              profile={profile}
              onOpenAccount={() => navigate('account')}
              configured={supabaseConfigured}
              authReady={authReady}
              syncStatus={syncStatus}
              syncError={syncError}
              migrationRequired={migrationRequired}
              hasCloudData={Boolean(pendingCloudStore)}
              hasLocalData={hasSavedData(store)}
              onImportLocal={importLocalData}
              onUseCloud={useCloudData}
              onStartFresh={() => completeMigration(emptyStore())}
              onRetrySync={retryCloudSync}
            />
            <div className="brand">
              <img className="brand-mark" src={`${import.meta.env.BASE_URL}yomi-mark.svg`} alt="" />
              <span className="brand-name">Yomi</span>
              <InfoButton label="Audio and data information">
                <span className="credits-tooltip-content">
                  <span><b>Word recordings:</b> <a href="https://github.com/tofugu/japanese-vocabulary-pronunciation-audio" target="_blank" rel="noopener noreferrer">WaniKani / Tofugu</a>, CC BY-SA 4.0.</span>
                  <span><b>Synthetic voice:</b> <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:九州そら</a>.</span>
                  <span><b>Kanji sentences and natural audio:</b> <a href="https://tatoeba.org/" target="_blank" rel="noopener noreferrer">Tatoeba</a>. Individual credits and license links are shown beside each example; CC BY-NC recordings are non-commercial.</span>
                  <span><b>Pitch accents:</b> <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>.</span>
                </span>
              </InfoButton>
            </div>
            <SectionNav value={page} onNavigate={navigate} isAdmin={Boolean(profile?.is_admin)} />
          </div>
        </header>

        <main>
          {page === 'drill' && <Drill key={resetVersion} active prefs={prefs} setPreference={setPreference} store={store} setStore={setStore} notify={notify} items={deckItems} />}
          {page === 'pacer' && <Pacer active prefs={prefs} setPreference={setPreference} notify={notify} items={deckItems} />}
          {page === 'alike' && <LookalikeTab active store={store} setStore={setStore} />}
          {page === 'progress' && <ProgressTab store={store} setStore={setStore} notify={notify} items={deckItems} />}
          {page === 'kanji' && (
            <KanjiDeck
              prefs={prefs}
              unlockedGroupIds={kanjiDeck.groups.slice(0, kanjiUnlockedCount).map((group) => group.id)}
              kanjiProgress={store.kanjiProgress}
              canManageLessons={Boolean(profile?.is_admin)}
              onPublishNext={publishNextKanjiLesson}
              onAdminRequest={() => setAdminNotice(true)}
              onViewKanji={(character, groupId) => recordKanjiProgress(character, groupId, 'views')}
              onRevealKanji={(character, groupId) => recordKanjiProgress(character, groupId, 'reveals')}
              onRateKanji={(character, groupId, rating) => recordKanjiProgress(character, groupId, 'rating', rating)}
              notify={notify}
            />
          )}
          {page === 'add' && <AddWords customItems={store.customItems || []} onAdd={addCustomItem} onDelete={deleteCustomItem} items={deckItems} />}
          {page === 'decks' && profile?.is_admin && (
            <DeckAdmin items={deckItems} loadError={deckCatalogError} onSaveItem={saveDeckItem} onDeleteItem={deleteDeckItem} />
          )}
          {page === 'account' && (
            <AccountPage
              user={authSession?.user || null}
              profile={profile}
              profileLoading={profileLoading}
              profileError={profileError}
              onSaveProfile={saveProfile}
              onUploadAvatar={uploadAvatar}
              onRemoveAvatar={removeAvatar}
              onSetPassword={setAccountPassword}
              onDeleteAccount={deleteAccount}
              onSignOut={signOutAccount}
            />
          )}
        </main>

      </div>
      <SettingsBar page={page} prefs={prefs} setPreference={setPreference} resetSection={resetSection} resetAll={resetAll} notify={notify} onDrillReset={() => setResetVersion((version) => version + 1)} customItems={store.customItems || []} items={deckItems} />
      <Toast message={toast} />
      {adminNotice && (
        <div className="account-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAdminNotice(false);
        }}>
          <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-notice-title">
            <button className="account-close" type="button" aria-label="Close" onClick={() => setAdminNotice(false)}>×</button>
            <h2 id="admin-notice-title">Admin access required</h2>
            <p className="hint">Only the Yomi admin can unlock lessons for everyone. Please contact <a href="mailto:syedaddan@gmail.com">syedaddan@gmail.com</a>.</p>
            <button className="btn primary account-action" type="button" onClick={() => setAdminNotice(false)}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}
