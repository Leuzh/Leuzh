#!/usr/bin/env node
import {performance} from 'node:perf_hooks';
import {createRun, updateRun} from './engine.mjs';

function parse(args) {
  const config = {iterations: 1200, enemies: 210, gems: 300};
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'help') config.help = true;
    else if (['iterations', 'enemies', 'gems'].includes(key)) config[key] = Number(value);
    else throw new Error(`Option inconnue: --${key}`);
  }
  if (!Number.isInteger(config.iterations) || config.iterations < 1) throw new Error('iterations doit être un entier positif.');
  if (!Number.isInteger(config.enemies) || config.enemies < 0 || config.enemies > 210) throw new Error('enemies doit être entre 0 et 210.');
  if (!Number.isInteger(config.gems) || config.gems < 0 || config.gems > 5000) throw new Error('gems doit être entre 0 et 5000.');
  return config;
}

function benchmark(config) {
  const state = createRun({random: () => .5});
  state.spawn = 1000;
  state.fire = 1000;
  state.emberLevel = 6;
  state.emberCooldown = 1000;
  state.orbitLevel = 5;
  state.bellLevel = 5;
  for (let i = 0; i < config.enemies; i++) {
    const angle = i * 2.399963229728653, radius = i < 32 ? 75 + (i % 5) * 10 : 900 + (i % 17) * 12;
    state.enemies.push({x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, hp: 1e9, max: 1e9, spd: 0, dmg: 0, r: 10, elite: false});
  }
  for (let i = 0; i < config.gems; i++) {
    const angle = i * 2.399963229728653, radius = 900 + (i % 23) * 8;
    state.gems.push({x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, value: 1});
  }
  const viewport = {width: 800, height: 600}, input = {x: 0, y: 0};
  for (let i = 0; i < Math.min(120, config.iterations); i++) updateRun(state, 1 / 60, input, viewport);
  const timings = [];
  for (let i = 0; i < config.iterations; i++) {
    const before = performance.now();
    updateRun(state, 1 / 60, input, viewport);
    timings.push(performance.now() - before);
  }
  timings.sort((a, b) => a - b);
  const sum = timings.reduce((total, value) => total + value, 0);
  const percentile = p => timings[Math.min(timings.length - 1, Math.floor((timings.length - 1) * p))];
  return {
    iterations: config.iterations, enemies: state.enemies.length, gems: state.gems.length,
    orbitLevel: state.orbitLevel, emberLevel: state.emberLevel, bellLevel: state.bellLevel,
    stepMsMean: Number((sum / timings.length).toFixed(4)),
    stepMsP95: Number(percentile(.95).toFixed(4)), stepMsMax: Number(timings.at(-1).toFixed(4)),
    simulatedSeconds: Number((config.iterations / 60).toFixed(2)),
    wallSeconds: Number((sum / 1000).toFixed(3)), platform: process.platform,
    arch: process.arch, node: process.version
  };
}

try {
  const config = parse(process.argv.slice(2));
  if (config.help) console.log('Usage: node infinite-night/benchmark.mjs [--iterations=1200] [--enemies=210] [--gems=300]');
  else console.log(JSON.stringify(benchmark(config)));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
