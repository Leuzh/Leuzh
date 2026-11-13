import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLayout, detectOrientation} from './layouts.mjs';
import {createDefaultState} from './storage.mjs';

class Card {
  constructor(id) { this.dataset = {widget: id}; this.hidden = false; }
}

class Grid {
  constructor(ids) { this.cards = ids.map(id => new Card(id)); this.dataset = {}; }
  querySelectorAll() { return this.cards; }
  append(card) { this.cards = this.cards.filter(item => item !== card); this.cards.push(card); }
}

test('orientation detection uses the media query and has a dimension fallback', () => {
  assert.equal(detectOrientation({matchMedia: () => ({matches: true})}), 'portrait');
  assert.equal(detectOrientation({matchMedia: () => ({matches: false})}), 'landscape');
  assert.equal(detectOrientation({innerHeight: 800, innerWidth: 400}), 'portrait');
});

test('the active orientation applies only its own order, visibility and spans', () => {
  const state = createDefaultState();
  state.layouts.portrait.order.reverse();
  state.layouts.portrait.widgets.weather.visible = false;
  const grid = new Grid(['weather', 'battery', 'audio', 'fragments']);
  assert.equal(applyLayout(grid, state.layouts, 'portrait'), true);
  assert.deepEqual(grid.cards.map(card => card.dataset.widget), ['fragments', 'audio', 'battery', 'weather']);
  assert.equal(grid.cards.at(-1).hidden, true);
  assert.equal(grid.cards.find(card => card.dataset.widget === 'audio').dataset.layoutSpan, '2');
  assert.deepEqual(state.layouts.landscape.order, ['weather', 'battery', 'audio', 'fragments']);
});

test('invalid widget collections do not partially mutate the dashboard', () => {
  const grid = new Grid(['weather', 'battery', 'audio', 'fragments']);
  const original = grid.cards.slice();
  const state = createDefaultState();
  state.layouts.portrait.order[0] = 'missing';
  assert.equal(applyLayout(grid, state.layouts, 'portrait'), false);
  assert.deepEqual(grid.cards, original);
});
