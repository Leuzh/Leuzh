import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun, createSeededRandom, updateRun, UPGRADES, getUpgradeChoices, SPAWN_PROFILES} from './engine.mjs';
import {joystickPosition} from './controls.mjs';

function play(seed) {
  const state = createRun({random: createSeededRandom(seed)});
  for (let i = 0; i < 1800 && !state.dead; i++) {
    const event = updateRun(state, 1 / 30, {x: 0, y: 0}, {width: 800, height: 600});
    if (event === 'level-up') { UPGRADES[1][2](state); state.paused = false; }
  }
  const {random, upgradeRandom, ...snapshot} = state;
  return snapshot;
}

test('seeded random generator repeats its sequence and varies across seeds', () => {
  const a = createSeededRandom(123), b = createSeededRandom(123), c = createSeededRandom(124);
  assert.deepEqual(Array.from({length: 8}, a), Array.from({length: 8}, b));
  assert.notDeepEqual(Array.from({length: 8}, createSeededRandom(123)), Array.from({length: 8}, c));
});

test('simulation with same seed and inputs is reproducible', () => {
  assert.deepEqual(play(4321), play(4321));
  assert.notDeepEqual(play(4321), play(9876));
});

test('first spawn uses logical viewport dimensions', () => {
  const state = createRun({random: () => .25});
  updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 300, height: 200});
  const enemy = state.enemies[0];
  const distance = Math.hypot(enemy.x, enemy.y);
  assert.ok(distance < 210 && distance > 200, `distance attendue proche du rayon logique 210, obtenue: ${distance}`);
});

test('spawn interval eases the opening and reaches a five-per-second floor', () => {
  const state = createRun({random: () => .5});
  state.elapsed = 10 * 60 - 1 / 60;
  updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 800, height: 600});
  assert.ok(Math.abs(state.spawn - .78) < 1e-9);
  state.elapsed = 60 * 60 - 1 / 60;
  state.spawn = 0;
  updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 800, height: 600});
  assert.ok(Math.abs(state.spawn - .2) < 1e-9);
  const classic = createRun({random: () => .5});
  updateRun(classic, 1 / 60, {x: 0, y: 0}, {width: 800, height: 600}, SPAWN_PROFILES.classic);
  assert.ok(Math.abs(classic.spawn - .8) < 1e-4);
});

test('movement input is normalized and level-up pauses simulation', () => {
  const state = createRun({random: () => .5});
  updateRun(state, 1, {x: 1, y: 1}, {width: 300, height: 200});
  assert.ok(Math.abs(Math.hypot(state.x, state.y) - 205) < 1e-9);
  state.gems.push({x: state.x, y: state.y, value: state.need});
  assert.equal(updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 300, height: 200}), 'level-up');
  assert.equal(state.paused, true);
  assert.equal(state.level, 2);
});

test('maxed upgrades stop appearing and orbital upgrade caps at rank five', () => {
  const state = createRun({random: () => 0});
  state.orbitLevel = 5;
  state.emberLevel = 6;
  state.bellLevel = 5;
  state.bloodLevel = 5;
  const choices = getUpgradeChoices(state, UPGRADES.length);
  assert.equal(choices.some(([name]) => name === 'Sceaux orbitaux'), false);
  assert.equal(choices.some(([name]) => name === 'Braises en chaîne'), false);
  assert.equal(choices.some(([name]) => name === 'Cloche funèbre'), false);
  assert.equal(choices.some(([name]) => name === 'Sceau sanguin'), false);
  UPGRADES.find(([name]) => name === 'Sceaux orbitaux')[2](state);
  assert.equal(state.orbitLevel, 5);
  UPGRADES.find(([name]) => name === 'Cloche funèbre')[2](state);
  UPGRADES.find(([name]) => name === 'Sceau sanguin')[2](state);
  assert.equal(state.bellLevel, 5);
  assert.equal(state.bloodLevel, 5);
});

test('bell damages nearby enemies and sets its cooldown', () => {
  const state = createRun({random: () => .5});
  state.spawn = 100;
  state.fire = 100;
  state.bellLevel = 5;
  state.enemies.push({x: 50, y: 0, hp: 1000, max: 1000, spd: 0, dmg: 0, r: 10, elite: false, cool: 1});
  updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 300, height: 200});
  assert.ok(state.enemies[0].hp < 1000);
  assert.ok(state.bellCooldown > 2.4);
});

test('blood seal heals on kills but cannot revive a defeated player', () => {
  const state = createRun({random: () => .5});
  state.spawn = 100;
  state.fire = 100;
  state.hp = 50;
  state.bloodLevel = 3;
  state.enemies.push({x: 30, y: 0, hp: 0, max: 1, spd: 0, dmg: 0, r: 10, elite: false, cool: 1});
  updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 300, height: 200});
  assert.equal(state.kills, 1);
  assert.ok(Math.abs(state.hp - 50.6) < 1e-9);
  state.hp = 0;
  state.dead = false;
  state.enemies.push({x: 30, y: 0, hp: 0, max: 1, spd: 0, dmg: 0, r: 10, elite: false, cool: 1});
  assert.equal(updateRun(state, 1 / 60, {x: 0, y: 0}, {width: 300, height: 200}), 'death');
  assert.equal(state.hp, 0);
});

test('upgrade offers are unique and deterministic for a fixed random stream', () => {
  const a = createRun({random: createSeededRandom(55)});
  const b = createRun({random: createSeededRandom(55)});
  const first = getUpgradeChoices(a), second = getUpgradeChoices(b);
  assert.deepEqual(first.map(([name]) => name), second.map(([name]) => name));
  assert.equal(new Set(first.map(([name]) => name)).size, first.length);
});

test('touch joystick stays centered inside its deadzone', () => {
  const point = joystickPosition(176, 176, {left: 100, top: 100, width: 152, height: 152});
  assert.deepEqual([point.x, point.y, point.offsetX, point.offsetY], [0, 0, 0, 0]);
});

test('touch joystick clamps at its radius and handles zero-size bounds', () => {
  const rect = {left: 100, top: 100, width: 152, height: 152};
  const point = joystickPosition(300, 176, rect);
  assert.ok(Math.abs(point.x - 1) < 1e-12);
  assert.equal(point.y, 0);
  const hidden = joystickPosition(10, 10, {left: 0, top: 0, width: 0, height: 0});
  assert.deepEqual([hidden.x, hidden.y, hidden.offsetX, hidden.offsetY], [0, 0, 0, 0]);
});
