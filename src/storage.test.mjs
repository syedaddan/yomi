import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, userStorageKey } from './storage.js';

test('keeps authenticated local progress separate from anonymous browser progress', () => {
  assert.equal(userStorageKey('user-123'), `${STORAGE_KEY}:user:user-123`);
  assert.notEqual(userStorageKey('user-123'), userStorageKey('user-456'));
  assert.notEqual(userStorageKey('user-123'), STORAGE_KEY);
});
