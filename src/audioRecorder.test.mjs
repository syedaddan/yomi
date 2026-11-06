import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecordingSupported, mapRecordingError } from './audioRecorder.js';

test('isRecordingSupported handles environment without navigator gracefully', () => {
  // In node.js CLI test environment without browser navigator.mediaDevices
  const supported = isRecordingSupported();
  assert.equal(typeof supported, 'boolean');
});

test('mapRecordingError provides user-friendly actionable error messages', () => {
  const notAllowed = new Error('Permission denied');
  notAllowed.name = 'NotAllowedError';
  assert.ok(mapRecordingError(notAllowed).includes('grant microphone access'));

  const notFound = new Error('Requested device not found');
  notFound.name = 'NotFoundError';
  assert.ok(mapRecordingError(notFound).includes('No microphone was found'));

  const inUse = new Error('Hardware error');
  inUse.name = 'NotReadableError';
  assert.ok(mapRecordingError(inUse).includes('currently in use'));

  const security = new Error('Insecure origin');
  security.name = 'SecurityError';
  assert.ok(mapRecordingError(security).includes('secure'));

  const generic = new Error('Something went wrong');
  assert.equal(mapRecordingError(generic), 'Something went wrong');
});
