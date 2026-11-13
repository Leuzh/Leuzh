import test from 'node:test';
import assert from 'node:assert/strict';
import {initBatteryWidget} from './battery.mjs';

class Element {
  attributes = {};
  style = {};
  textContent = '';
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
}

function makeDocument() {
  const elements = Object.fromEntries(['battery-value', 'battery-fill', 'battery-meter', 'battery-status'].map(id => [id, new Element()]));
  return {elements, getElementById: id => elements[id]};
}

test('unsupported battery API reports unavailable instead of inventing a level', async () => {
  const documentRef = makeDocument();
  await initBatteryWidget({navigatorRef: {}, documentRef});
  assert.equal(documentRef.elements['battery-value'].textContent, '—');
  assert.match(documentRef.elements['battery-status'].textContent, /non prises en charge/i);
  assert.equal('aria-valuenow' in documentRef.elements['battery-meter'].attributes, false);
});

test('supported battery values update on level and charging events', async () => {
  const handlers = new Map();
  const battery = {
    level: .73, charging: false,
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: name => handlers.delete(name)
  };
  const documentRef = makeDocument();
  const cleanup = await initBatteryWidget({navigatorRef: {getBattery: async () => battery}, documentRef});
  assert.equal(documentRef.elements['battery-value'].textContent, '73 %');
  assert.equal(documentRef.elements['battery-status'].textContent, 'Sur batterie');
  battery.level = .42; battery.charging = true;
  handlers.get('levelchange')();
  assert.equal(documentRef.elements['battery-value'].textContent, '42 %');
  assert.equal(documentRef.elements['battery-status'].textContent, 'En charge');
  cleanup();
  assert.equal(handlers.size, 0);
});

test('battery API failures are reported as unavailable', async () => {
  const documentRef = makeDocument();
  await initBatteryWidget({navigatorRef: {getBattery: async () => {throw new Error('denied');}}, documentRef});
  assert.match(documentRef.elements['battery-status'].textContent, /indisponibles/i);
});
