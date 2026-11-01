import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('renders account actions for a signed-in user', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { default: AccountPage } = await vite.ssrLoadModule('/src/components/AccountPage.jsx');
    const html = renderToString(React.createElement(AccountPage, {
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

    assert.match(html, /Sign out/);
    assert.match(html, /Delete account/);
  } finally {
    await vite.close();
  }
});
