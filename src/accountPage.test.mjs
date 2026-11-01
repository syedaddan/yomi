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
    }));
    assert.match(settingsHtml, /Furigana/);
    assert.doesNotMatch(settingsHtml, /settings-controls-row/);
    assert.doesNotMatch(settingsHtml, /Reset all settings/);
  } finally {
    await vite.close();
  }
});
