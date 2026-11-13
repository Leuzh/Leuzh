import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_DATABASE_NAME, AUDIO_OBJECT_STORE, formatAudioTime, isAudioFile} from './audio.mjs';

test('audio widget accepts local audio formats and rejects unrelated files', () => {
  assert.equal(isAudioFile({name: 'voice.ogg', type: ''}), true);
  assert.equal(isAudioFile({name: 'recording', type: 'audio/webm'}), true);
  assert.equal(isAudioFile({name: 'notes.pdf', type: 'application/pdf'}), false);
  assert.equal(isAudioFile(null), false);
});

test('audio time display is stable and storage is kept in a dedicated NEXUS database', () => {
  assert.equal(formatAudioTime(0), '00:00');
  assert.equal(formatAudioTime(125.9), '02:05');
  assert.equal(formatAudioTime(-1), '00:00');
  assert.match(AUDIO_DATABASE_NAME, /^nexus\./);
  assert.equal(AUDIO_OBJECT_STORE, 'tracks');
});
