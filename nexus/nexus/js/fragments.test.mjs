import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILT_IN_FRAGMENTS, normalizeFragmentText} from './fragments.mjs';
import {createDefaultState, saveState} from './storage.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('built-in fragments are available without network and are plain text', () => {
  assert.ok(BUILT_IN_FRAGMENTS.length >= 5);
  assert.ok(BUILT_IN_FRAGMENTS.every(text => typeof text === 'string' && text.length > 0));
});

test('personal fragment text is trimmed and bounded', () => {
  assert.equal(normalizeFragmentText('  Une pensée.  '), 'Une pensée.');
  assert.equal(normalizeFragmentText(' '.repeat(10)), '');
  assert.equal(normalizeFragmentText('x'.repeat(600)).length, 500);
});

test('custom phrases persist in the NEXUS state and malformed quotes are rejected', () => {
  const state = createDefaultState();
  state.widgets.fragments.customQuotes.push({id: 'q1', text: 'Phrase locale'});
  const storage = new MemoryStorage();
  assert.equal(saveState(storage, state).ok, true);
  assert.equal([...storage.values.keys()].every(key => key.startsWith('nexus.')), true);
  state.widgets.fragments.customQuotes.push({id: 'q2', text: ' '});
  assert.equal(saveState(storage, state).ok, false);
});
