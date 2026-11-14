import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_ID, LEGACY_STATE_KEY, OLDER_STATE_KEY, RECOVERY_KEY, STATE_KEY, clearRecovery, createDefaultState,
  exportJson, loadState, parseImportJson, readRecovery, saveState, validateState
} from './storage.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const fixedDate = new Date('2026-11-13T12:30:00.000Z');

test('default layouts are distinct, complete and independently editable', () => {
  const state = createDefaultState(fixedDate);
  assert.deepEqual(state.layouts.portrait.order, ['weather', 'battery', 'audio', 'fragments']);
  assert.equal(state.layouts.portrait.widgets.audio.span, 2);
  assert.equal(state.layouts.landscape.widgets.audio.span, 1);
  state.layouts.portrait.order.reverse();
  assert.deepEqual(state.layouts.landscape.order, ['weather', 'battery', 'audio', 'fragments']);
});

test('defaults persist only under nexus.* and reload without loss', () => {
  const storage = new MemoryStorage();
  const loaded = loadState(storage, fixedDate);
  assert.equal(loaded.state.schemaVersion, 3);
  assert.equal(storage.getItem(STATE_KEY) !== null, true);
  assert.equal([...storage.values.keys()].every(key => key.startsWith('nexus.')), true);
  const changed = {...loaded.state, preferences: {timeFormat: '12'}};
  assert.equal(saveState(storage, changed, fixedDate).ok, true);
  assert.equal(loadState(storage, fixedDate).state.preferences.timeFormat, '12');
});

test('saving NEXUS settings leaves existing Lipoip and game keys untouched', () => {
  const storage = new MemoryStorage();
  storage.setItem('lipoip-equipped-title-v1', 'scribe');
  storage.setItem('lipoip-secret-registry-v1', '["folie"]');
  storage.setItem('infiniteNight.v1', '{"runs":[]}');
  const loaded = loadState(storage, fixedDate);
  saveState(storage, {...loaded.state, preferences: {timeFormat: '12'}}, fixedDate);
  assert.equal(storage.getItem('lipoip-equipped-title-v1'), 'scribe');
  assert.equal(storage.getItem('lipoip-secret-registry-v1'), '["folie"]');
  assert.equal(storage.getItem('infiniteNight.v1'), '{"runs":[]}');
  assert.equal([...storage.values.keys()].filter(key => key.startsWith('nexus.')).length, 1);
});

test('export/import round trip validates before returning a restorable state', () => {
  const state = createDefaultState(fixedDate);
  state.layouts.landscape.order.reverse();
  const json = exportJson(state, fixedDate);
  const imported = parseImportJson(json);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.state.layouts.landscape.order, state.layouts.landscape.order);
  assert.equal(JSON.parse(json).format, APP_ID);
});

test('invalid, oversized and incompatible imports are rejected', () => {
  const valid = JSON.parse(exportJson(createDefaultState(fixedDate), fixedDate));
  const duplicateWidget = structuredClone(valid);
  duplicateWidget.data.layouts.portrait.order[1] = 'weather';
  assert.equal(parseImportJson(JSON.stringify(duplicateWidget)).ok, false);
  const futureVersion = {...valid, schemaVersion: 99};
  assert.equal(parseImportJson(JSON.stringify(futureVersion)).ok, false);
  assert.equal(parseImportJson('{broken').ok, false);
  assert.equal(parseImportJson('x'.repeat(1024 * 1024 + 1)).ok, false);
});

test('corrupt local data is preserved in the recovery namespace and defaults remain usable', () => {
  const storage = new MemoryStorage();
  const corrupt = '{broken nexus data';
  storage.setItem(STATE_KEY, corrupt);
  const result = loadState(storage, fixedDate);
  assert.equal(result.state.schemaVersion, 3);
  assert.equal(result.recoverySaved, true);
  assert.equal(readRecovery(storage).raw, corrupt);
  assert.equal(storage.getItem(STATE_KEY), corrupt);
  assert.equal(clearRecovery(storage), true);
  assert.equal(storage.getItem(RECOVERY_KEY), null);
});

test('unknown stored schema is quarantined rather than silently overwritten', () => {
  const storage = new MemoryStorage();
  const future = JSON.stringify({schemaVersion: 7, other: true});
  storage.setItem(STATE_KEY, future);
  const result = loadState(storage, fixedDate);
  assert.equal(result.recoverySaved, true);
  assert.equal(storage.getItem(STATE_KEY), future);
  assert.match(result.warning, /non compatible/i);
});

test('storage failures return a clear warning without throwing', () => {
  const unavailable = {getItem() { throw new Error('denied'); }};
  const result = loadState(unavailable, fixedDate);
  assert.equal(result.state.schemaVersion, 3);
  assert.match(result.warning, /inaccessible/i);
  const full = {setItem() { throw new Error('quota'); }};
  assert.equal(saveState(full, createDefaultState(fixedDate), fixedDate).ok, false);
});

test('v1 settings migrate to v3 while retaining both layouts and the hour preference', () => {
  const storage = new MemoryStorage();
  const previous = createDefaultState(fixedDate);
  previous.schemaVersion = 1;
  delete previous.widgets;
  previous.preferences.timeFormat = '12';
  previous.layouts.portrait.order.reverse();
  for (const layout of Object.values(previous.layouts)) {
    for (const widget of Object.values(layout.widgets)) delete widget.size;
  }
  storage.setItem(OLDER_STATE_KEY, JSON.stringify(previous));
  const migrated = loadState(storage, fixedDate);
  assert.equal(migrated.state.schemaVersion, 3);
  assert.equal(migrated.state.preferences.timeFormat, '12');
  assert.deepEqual(migrated.state.layouts.portrait.order, previous.layouts.portrait.order);
  assert.deepEqual(migrated.state.layouts.landscape.order, previous.layouts.landscape.order);
  assert.equal(storage.getItem(OLDER_STATE_KEY), null);
  assert.notEqual(storage.getItem(STATE_KEY), null);
});

test('v2 settings migrate to v3 while preserving weather, fragments and both layouts', () => {
  const storage = new MemoryStorage();
  const previous = createDefaultState(fixedDate);
  previous.schemaVersion = 2;
  for (const layout of Object.values(previous.layouts)) {
    for (const widget of Object.values(layout.widgets)) delete widget.size;
  }
  previous.widgets.weather = {city: 'Quillan, Occitanie, France', latitude: 42.87, longitude: 2.18};
  previous.widgets.fragments.customQuotes = [{id: 'q1', text: 'Une phrase à garder'}];
  previous.layouts.landscape.order.reverse();
  storage.setItem(LEGACY_STATE_KEY, JSON.stringify(previous));
  const migrated = loadState(storage, fixedDate);
  assert.equal(migrated.state.schemaVersion, 3);
  assert.equal(migrated.state.widgets.weather.city, 'Quillan, Occitanie, France');
  assert.deepEqual(migrated.state.widgets.fragments.customQuotes, previous.widgets.fragments.customQuotes);
  assert.equal(migrated.state.layouts.portrait.widgets.weather.size, 'standard');
  assert.deepEqual(migrated.state.layouts.landscape.order, previous.layouts.landscape.order);
  assert.equal(storage.getItem(LEGACY_STATE_KEY), null);
});

test('v1 exports can be imported and migrated before restoration', () => {
  const legacy = createDefaultState(fixedDate);
  legacy.schemaVersion = 1;
  delete legacy.widgets;
  for (const layout of Object.values(legacy.layouts)) {
    for (const widget of Object.values(layout.widgets)) delete widget.size;
  }
  const result = parseImportJson(JSON.stringify({
    format: APP_ID, schemaVersion: 1, exportedAt: fixedDate.toISOString(), data: legacy
  }));
  assert.equal(result.ok, true);
  assert.equal(result.state.schemaVersion, 3);
  assert.equal(result.state.widgets.fragments.intervalSeconds, 60);
});
