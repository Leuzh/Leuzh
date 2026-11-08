#!/usr/bin/env node
import {performance} from 'node:perf_hooks';
import {createRun, createSeededRandom, updateRun, getUpgradeChoices, SPAWN_PROFILES} from './engine.mjs';

function options(args) {
  const out = {minutes: [1, 10, 30], seeds: [1], step: 1 / 30, policy: 'kite', build: 'first', spawnProfile: 'eased'};
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'minutes') out.minutes = value.split(',').map(Number);
    else if (key === 'seeds') out.seeds = value.split(',').map(Number);
    else if (key === 'step') out.step = Number(value);
    else if (key === 'policy') out.policy = value;
    else if (key === 'build') out.build = value;
    else if (key === 'spawn-profile') out.spawnProfile = value;
    else if (key === 'help') out.help = true;
    else throw new Error(`Option inconnue: --${key}`);
  }
  if (!out.minutes.length || out.minutes.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('minutes doit contenir des durées positives.');
  if (!out.seeds.length || out.seeds.some(n => !Number.isFinite(n))) throw new Error('seeds doit contenir des nombres.');
  if (!(out.step > 0 && out.step <= .04)) throw new Error('step doit être > 0 et <= 0.04 seconde.');
  if (!['kite', 'stand'].includes(out.policy)) throw new Error('policy doit être kite ou stand.');
  if (!['first', 'blade', 'orbit', 'ember', 'bell', 'blood', 'guard'].includes(out.build)) throw new Error('build doit être first, blade, orbit, ember, bell, blood ou guard.');
  if (!Object.hasOwn(SPAWN_PROFILES, out.spawnProfile)) throw new Error('spawn-profile doit être classic ou eased.');
  return out;
}

const buildPriorities = {
  blade: ['Lame affûtée', 'Tome des brumes', 'Sceaux orbitaux', 'Braises en chaîne', 'Manteau d’ombre', 'Cœur de grenat'],
  orbit: ['Sceaux orbitaux', 'Lame affûtée', 'Tome des brumes', 'Manteau d’ombre', 'Cœur de grenat', 'Bottes lunaires'],
  ember: ['Braises en chaîne', 'Lame affûtée', 'Tome des brumes', 'Manteau d’ombre', 'Cœur de grenat', 'Bottes lunaires'],
  bell: ['Cloche funèbre', 'Lame affûtée', 'Tome des brumes', 'Manteau d’ombre', 'Cœur de grenat'],
  blood: ['Sceau sanguin', 'Manteau d’ombre', 'Cœur de grenat', 'Bottes lunaires', 'Lame affûtée', 'Tome des brumes'],
  guard: ['Manteau d’ombre', 'Cœur de grenat', 'Bottes lunaires', 'Orbe vorace', 'Lame affûtée', 'Tome des brumes']
};

function chooseUpgrade(choices, build) {
  if (build === 'first') return choices[0];
  let selected = choices[0], bestRank = Infinity;
  for (const choice of choices) {
    const rank = buildPriorities[build].indexOf(choice[0]);
    if (rank >= 0 && rank < bestRank) { selected = choice; bestRank = rank; }
  }
  return selected;
}

function inputFor(state, policy) {
  if (policy === 'stand' || !state.enemies.length) return {x: 0, y: 0};
  let nearest = null, distance = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - state.x, enemy.y - state.y);
    if (d < distance) { nearest = enemy; distance = d; }
  }
  if (distance < 220) return {x: state.x - nearest.x, y: state.y - nearest.y};
  const angle = state.elapsed * .22;
  return {x: Math.cos(angle), y: Math.sin(angle)};
}

function run(minutes, seed, step, policy, build, spawnProfile) {
  const state = createRun({random: createSeededRandom(seed), upgradeRandom: createSeededRandom((seed ^ 0x9e3779b9) >>> 0)});
  const viewport = {width: 800, height: 600};
  const duration = minutes * 60;
  let maxEnemies = 0, maxGems = 0, updates = 0, totalUpdateMs = 0, maxUpdateMs = 0;
  const upgradePicks = {};
  const started = performance.now();
  while (state.elapsed < duration && !state.dead) {
    const dt = Math.min(step, duration - state.elapsed);
    const t0 = performance.now();
    const event = updateRun(state, dt, inputFor(state, policy), viewport, SPAWN_PROFILES[spawnProfile]);
    const elapsedMs = performance.now() - t0;
    totalUpdateMs += elapsedMs;
    maxUpdateMs = Math.max(maxUpdateMs, elapsedMs);
    updates++;
    maxEnemies = Math.max(maxEnemies, state.enemies.length);
    maxGems = Math.max(maxGems, state.gems.length);
    if (event === 'level-up') {
      const choices = getUpgradeChoices(state);
      const selected = chooseUpgrade(choices, build);
      selected[2](state);
      upgradePicks[selected[0]] = (upgradePicks[selected[0]] || 0) + 1;
      state.paused = false;
    }
  }
  return {
    seed, requestedMinutes: minutes, survivedSeconds: Number(state.elapsed.toFixed(2)),
    died: state.dead, level: state.level, kills: state.kills, hp: Number(state.hp.toFixed(1)),
    enemies: state.enemies.length, maxEnemies, gems: state.gems.length, maxGems,
    updates, meanUpdateMs: Number((totalUpdateMs / Math.max(1, updates)).toFixed(4)),
    maxUpdateMs: Number(maxUpdateMs.toFixed(4)), wallSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
    policy, build, spawnProfile, upgradePicks
  };
}

try {
  const config = options(process.argv.slice(2));
  if (config.help) {
    console.log('Usage: node infinite-night/simulate.mjs [--minutes=1,10,30] [--seeds=1,2] [--step=0.033333] [--policy=kite|stand] [--build=first|blade|orbit|ember|bell|blood|guard] [--spawn-profile=classic|eased]');
  } else {
    for (const minutes of config.minutes) for (const seed of config.seeds) console.log(JSON.stringify(run(minutes, seed, config.step, config.policy, config.build, config.spawnProfile)));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
