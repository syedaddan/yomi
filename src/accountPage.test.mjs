import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('renders signed-in account actions and the compact Kanji settings dock', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  try {
    const { default: AccountPage } = await vite.ssrLoadModule('/src/components/AccountPage.jsx');
    const accountHtml = renderToString(React.createElement(AccountPage, {
      user: { email: 'learner@example.com' },
      profile: null,
      profileLoading: false,
      profileError: '',
      onSaveProfile: async () => {},
      onUploadAvatar: async () => {},
      onRemoveAvatar: async () => {},
      onSetPassword: async () => {},
      onDeleteAccount: async () => {},
      onSignOut: async () => {},
    }));

    assert.match(accountHtml, /Sign out/);
    assert.match(accountHtml, /Delete account/);

    const { default: SettingsBar } = await vite.ssrLoadModule('/src/components/SettingsBar.jsx');
    const { DEFAULT_PREFS } = await vite.ssrLoadModule('/src/storage.js');
    const settingsHtml = renderToString(React.createElement(SettingsBar, {
      page: 'kanji',
      prefs: DEFAULT_PREFS,
      setPreference: () => {},
      resetSection: () => {},
      resetAll: () => {},
      onDrillReset: () => {},
      notify: () => {},
      kanjiGroups: [{ id: 'lesson-01' }],
      kanjiUnlockedCount: 1,
      selectedKanjiGroupId: 'lesson-01',
      onChangeKanjiGroup: () => {},
    }));
    assert.match(settingsHtml, /Furigana/);
    assert.doesNotMatch(settingsHtml, /settings-controls-row/);
    assert.doesNotMatch(settingsHtml, /Reset all settings/);

    const { default: DeckAdmin } = await vite.ssrLoadModule('/src/components/DeckAdmin.jsx');
    const deckAdminHtml = renderToString(React.createElement(DeckAdmin, {
      items: [],
      loadError: '',
      onSaveItem: async () => {},
      onDeleteItem: async () => {},
      kanjiGroups: [{ id: 'lesson-01', characters: ['一', '二'] }, { id: 'lesson-02', characters: ['三'] }],
      kanjiUnlockedCount: 1,
      onUnlockNextLesson: async () => {},
      onLockLastLesson: async () => {},
    }));
    assert.match(deckAdminHtml, /Kanji Lessons/);
    assert.match(deckAdminHtml, /Unlock next/);
    assert.match(deckAdminHtml, /Lock last/);
    assert.match(deckAdminHtml, /Kana &amp; Phrase Decks/);

    const { default: AccountPanel } = await vite.ssrLoadModule('/src/components/AccountPanel.jsx');
    const accountPanelHtml = renderToString(React.createElement(AccountPanel, {
      user: null,
      profile: null,
      onOpenAccount: () => {},
      configured: true,
      authReady: true,
      syncStatus: 'signed-out',
      syncError: '',
      migrationRequired: false,
      hasCloudData: false,
      hasLocalData: false,
      onImportLocal: () => {},
      onUseCloud: () => {},
      onStartFresh: () => {},
      onRetrySync: () => {},
    }));
    assert.match(accountPanelHtml, /account-pill/);
    assert.match(accountPanelHtml, /theme-toggle-header/);
  } finally {
    await vite.close();
  }
});
