import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeWeatherCode, fetchCurrentWeather, readWeatherCache, saveWeatherCache,
  searchLocations, WEATHER_CACHE_KEY, WEATHER_REFRESH_MS
} from './weather.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('city search uses French Open-Meteo geocoding and validates returned coordinates', async () => {
  let requested;
  const results = await searchLocations('Paris', async url => {
    requested = new URL(url);
    return {ok: true, json: async () => ({results: [
      {name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.85, longitude: 2.35},
      {name: 'Bad', latitude: 'not-a-number', longitude: 1}
    ]})};
  });
  assert.equal(requested.hostname, 'geocoding-api.open-meteo.com');
  assert.equal(requested.searchParams.get('language'), 'fr');
  assert.deepEqual(results, [{name: 'Paris, Île-de-France, France', latitude: 48.85, longitude: 2.35}]);
  await assert.rejects(searchLocations('P'), /deux caractères/i);
});

test('weather fetch requires real measurements and maps condition codes', async () => {
  const location = {name: 'Paris, France', latitude: 48.85, longitude: 2.35};
  const result = await fetchCurrentWeather(location, async url => {
    const request = new URL(url);
    assert.equal(request.hostname, 'api.open-meteo.com');
    assert.match(request.searchParams.get('current'), /apparent_temperature/);
    return {ok: true, json: async () => ({current: {
      temperature_2m: 15.2, apparent_temperature: 14.1, weather_code: 61, wind_speed_10m: 12
    }})};
  }, new Date('2026-11-13T12:00:00Z'));
  assert.deepEqual(result, {
    city: location.name, latitude: 48.85, longitude: 2.35,
    temperature: 15.2, apparentTemperature: 14.1, weatherCode: 61,
    windSpeed: 12, fetchedAt: '2026-11-13T12:00:00.000Z'
  });
  assert.equal(describeWeatherCode(61).label, 'Pluie');
  await assert.rejects(fetchCurrentWeather(location, async () => ({ok: true, json: async () => ({})})), /mesures attendues/i);
});

test('weather cache is isolated under nexus.* and keeps stale data available', () => {
  const storage = new MemoryStorage();
  const cache = {
    city: 'Lyon, France', latitude: 45.75, longitude: 4.85,
    temperature: 10, apparentTemperature: 8, weatherCode: 3, windSpeed: 5,
    fetchedAt: '2026-11-12T10:00:00.000Z'
  };
  assert.equal(saveWeatherCache(storage, cache), true);
  assert.deepEqual(readWeatherCache(storage), cache);
  assert.deepEqual([...storage.values.keys()], [WEATHER_CACHE_KEY]);
  assert.ok(WEATHER_REFRESH_MS >= 30 * 60 * 1000);
  storage.setItem(WEATHER_CACHE_KEY, '{');
  assert.equal(readWeatherCache(storage), null);
});
