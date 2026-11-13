export const WEATHER_CACHE_KEY = 'nexus.weather-cache.v1';
export const WEATHER_REFRESH_MS = 30 * 60 * 1000;

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

export function describeWeatherCode(code) {
  if (code === 0) return {label: 'Ciel dégagé', symbol: '☀'};
  if (code === 1) return {label: 'Principalement dégagé', symbol: '🌤'};
  if (code === 2) return {label: 'Partiellement nuageux', symbol: '⛅'};
  if (code === 3) return {label: 'Couvert', symbol: '☁'};
  if (code === 45 || code === 48) return {label: 'Brouillard', symbol: '≋'};
  if ([51, 53, 55, 56, 57].includes(code)) return {label: 'Bruine', symbol: '🌦'};
  if ([61, 63, 65, 66, 67].includes(code)) return {label: 'Pluie', symbol: '🌧'};
  if ([71, 73, 75, 77].includes(code)) return {label: 'Neige', symbol: '❄'};
  if ([80, 81, 82].includes(code)) return {label: 'Averses', symbol: '🌧'};
  if ([85, 86].includes(code)) return {label: 'Averses de neige', symbol: '🌨'};
  if ([95, 96, 99].includes(code)) return {label: 'Orage', symbol: '⛈'};
  return {label: 'Conditions inconnues', symbol: '◇'};
}

export function validateWeatherCache(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const {city, latitude, longitude, temperature, apparentTemperature, weatherCode, windSpeed, fetchedAt} = value;
  if (typeof city !== 'string' || !city.trim() || city.length > 120
    || !isFiniteNumber(latitude) || latitude < -90 || latitude > 90
    || !isFiniteNumber(longitude) || longitude < -180 || longitude > 180
    || !isFiniteNumber(temperature) || !isFiniteNumber(apparentTemperature)
    || !Number.isInteger(weatherCode) || weatherCode < 0 || weatherCode > 999
    || !isFiniteNumber(windSpeed) || windSpeed < 0
    || !Number.isFinite(Date.parse(fetchedAt))) return null;
  return {city: city.trim(), latitude, longitude, temperature, apparentTemperature, weatherCode, windSpeed, fetchedAt};
}

export function readWeatherCache(storage) {
  try {
    const raw = storage?.getItem(WEATHER_CACHE_KEY);
    return raw ? validateWeatherCache(JSON.parse(raw)) : null;
  } catch (_) { return null; }
}

export function saveWeatherCache(storage, cache) {
  const valid = validateWeatherCache(cache);
  if (!valid) return false;
  try { storage?.setItem(WEATHER_CACHE_KEY, JSON.stringify(valid)); return !!storage; }
  catch (_) { return false; }
}

function fetchWithTimeout(fetchImpl, url, timeoutMs = 12000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : 0;
  return Promise.resolve()
    .then(() => fetchImpl(url, controller ? {signal: controller.signal} : undefined))
    .then(response => {
      if (!response?.ok) throw new Error(`Réponse météo indisponible (${response?.status ?? 'réseau'}).`);
      return response.json();
    })
    .finally(() => { if (timer) clearTimeout(timer); });
}

export async function searchLocations(query, fetchImpl = globalThis.fetch) {
  const name = String(query || '').trim();
  if (name.length < 2) throw new Error('Saisis au moins deux caractères pour rechercher une ville.');
  if (typeof fetchImpl !== 'function') throw new Error('La recherche météo nécessite une connexion Internet.');
  const params = new URLSearchParams({name, count: '7', language: 'fr', format: 'json'});
  const payload = await fetchWithTimeout(fetchImpl, `https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!Array.isArray(payload?.results)) return [];
  return payload.results.flatMap(result => {
    if (typeof result?.name !== 'string' || !isFiniteNumber(result.latitude) || !isFiniteNumber(result.longitude)) return [];
    const locality = [result.name, result.admin1, result.country].filter(Boolean).join(', ');
    return [{name: locality.slice(0, 120), latitude: result.latitude, longitude: result.longitude}];
  });
}

export async function fetchCurrentWeather(location, fetchImpl = globalThis.fetch, now = new Date()) {
  if (typeof fetchImpl !== 'function') throw new Error('La météo nécessite une connexion Internet.');
  if (!location || !isFiniteNumber(location.latitude) || !isFiniteNumber(location.longitude)) {
    throw new Error('Choisis une ville valide avant d’actualiser la météo.');
  }
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    wind_speed_unit: 'kmh',
    timezone: 'auto'
  });
  const payload = await fetchWithTimeout(fetchImpl, `https://api.open-meteo.com/v1/forecast?${params}`);
  const current = payload?.current;
  if (!current || !isFiniteNumber(current.temperature_2m)
    || !isFiniteNumber(current.apparent_temperature)
    || !Number.isInteger(current.weather_code)
    || !isFiniteNumber(current.wind_speed_10m) || current.wind_speed_10m < 0) {
    throw new Error('La réponse météo ne contient pas toutes les mesures attendues.');
  }
  return validateWeatherCache({
    city: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    weatherCode: current.weather_code,
    windSpeed: current.wind_speed_10m,
    fetchedAt: now.toISOString()
  });
}

function formatUpdateTime(iso) {
  return new Intl.DateTimeFormat('fr-FR', {hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'}).format(new Date(iso));
}

export function initWeatherWidget({documentRef = document, storage, getState, commit, fetchImpl = globalThis.fetch, windowRef = window}) {
  const form = documentRef.getElementById('weather-search-form');
  const queryInput = documentRef.getElementById('weather-city-query');
  const resultsSelect = documentRef.getElementById('weather-city-results');
  const useCityButton = documentRef.getElementById('weather-use-city');
  const cityLabel = documentRef.getElementById('weather-current-city');
  const symbol = documentRef.getElementById('weather-symbol');
  const dataPanel = documentRef.getElementById('weather-data');
  const temperature = documentRef.getElementById('weather-temperature');
  const condition = documentRef.getElementById('weather-condition');
  const apparent = documentRef.getElementById('weather-apparent');
  const wind = documentRef.getElementById('weather-wind');
  const updated = documentRef.getElementById('weather-updated');
  const feedback = documentRef.getElementById('weather-feedback');
  const refreshButton = documentRef.getElementById('weather-refresh');
  let locations = [];
  let fetching = false;
  let timer = 0;
  let latestCache = readWeatherCache(storage);

  function selectedLocation() {
    const weather = getState().widgets.weather;
    return weather.city && Number.isFinite(weather.latitude) && Number.isFinite(weather.longitude)
      ? {name: weather.city, latitude: weather.latitude, longitude: weather.longitude}
      : null;
  }

  function cacheMatches(location) {
    return latestCache && location
      && latestCache.latitude === location.latitude && latestCache.longitude === location.longitude;
  }

  function paintCache(cache, stale) {
    dataPanel.hidden = false;
    const descriptor = describeWeatherCode(cache.weatherCode);
    symbol.textContent = descriptor.symbol;
    symbol.setAttribute('aria-label', descriptor.label);
    temperature.textContent = `${Math.round(cache.temperature)} °C`;
    condition.textContent = descriptor.label;
    apparent.textContent = `${Math.round(cache.apparentTemperature)} °C`;
    wind.textContent = `${Math.round(cache.windSpeed)} km/h`;
    updated.textContent = `${stale ? 'Dernière donnée' : 'Actualisé'} : ${formatUpdateTime(cache.fetchedAt)}`;
    cityLabel.textContent = cache.city;
  }

  async function refresh({force = false} = {}) {
    const location = selectedLocation();
    if (!location) {
      feedback.textContent = 'Recherche une ville pour afficher la météo.';
      return false;
    }
    if (fetching) return false;
    const cache = cacheMatches(location) ? latestCache : null;
    if (!force && cache && Date.now() - Date.parse(cache.fetchedAt) < WEATHER_REFRESH_MS) {
      paintCache(cache, false);
      feedback.textContent = 'Donnée récente du cache.';
      return true;
    }
    if (cache) paintCache(cache, true);
    fetching = true;
    refreshButton.disabled = true;
    feedback.textContent = 'Actualisation météo…';
    try {
      const fresh = await fetchCurrentWeather(location, fetchImpl);
      latestCache = fresh;
      const saved = saveWeatherCache(storage, fresh);
      paintCache(fresh, false);
      feedback.textContent = saved ? 'Météo actualisée.' : 'Météo actualisée, mais le cache local est indisponible.';
      return true;
    } catch (error) {
      if (cache) {
        paintCache(cache, true);
        feedback.textContent = `Connexion indisponible ; dernière donnée conservée (${formatUpdateTime(cache.fetchedAt)}).`;
      } else {
        dataPanel.hidden = true;
        feedback.textContent = error instanceof Error ? error.message : 'La météo est temporairement indisponible.';
      }
      return false;
    } finally {
      fetching = false;
      refreshButton.disabled = false;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const query = queryInput.value.trim();
    useCityButton.disabled = true;
    resultsSelect.hidden = true;
    feedback.textContent = 'Recherche de ville…';
    try {
      locations = await searchLocations(query, fetchImpl);
      resultsSelect.replaceChildren();
      for (const [index, location] of locations.entries()) {
        const option = documentRef.createElement('option');
        option.value = String(index);
        option.textContent = location.name;
        resultsSelect.append(option);
      }
      if (!locations.length) {
        feedback.textContent = 'Aucune ville trouvée. Essaie un nom plus précis.';
        return;
      }
      resultsSelect.hidden = false;
      useCityButton.disabled = false;
      feedback.textContent = `${locations.length} résultat${locations.length > 1 ? 's' : ''}. Sélectionne la ville à utiliser.`;
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : 'La recherche de ville a échoué.';
    }
  });

  useCityButton.addEventListener('click', async () => {
    const location = locations[Number(resultsSelect.value)];
    if (!location) {
      feedback.textContent = 'Sélectionne une ville dans les résultats.';
      return;
    }
    const current = getState();
    const next = {
      ...current,
      widgets: {...current.widgets, weather: {city: location.name, latitude: location.latitude, longitude: location.longitude}}
    };
    if (commit(next, `Ville météo enregistrée : ${location.name}.`)) {
      queryInput.value = location.name.split(',')[0];
      resultsSelect.hidden = true;
      latestCache = cacheMatches(location) ? latestCache : null;
      await refresh({force: true});
    }
  });

  refreshButton.addEventListener('click', () => refresh({force: true}));
  timer = windowRef.setInterval(() => {
    if (documentRef.visibilityState !== 'hidden') refresh({force: true});
  }, WEATHER_REFRESH_MS);
  windowRef.addEventListener('online', () => refresh({force: true}));
  documentRef.addEventListener('visibilitychange', () => {
    if (documentRef.visibilityState === 'visible') refresh();
  });

  const activeLocation = selectedLocation();
  queryInput.value = activeLocation?.name.split(',')[0] || '';
  cityLabel.textContent = activeLocation?.name || 'Aucune ville sélectionnée';
  if (cacheMatches(activeLocation)) {
    const isStale = Date.now() - Date.parse(latestCache.fetchedAt) >= WEATHER_REFRESH_MS;
    paintCache(latestCache, isStale);
    if (isStale) refresh();
    else feedback.textContent = 'Donnée restaurée depuis le cache.';
  } else {
    dataPanel.hidden = true;
    feedback.textContent = activeLocation ? 'Aucune donnée en cache pour cette ville.' : 'Recherche une ville pour afficher la météo.';
    if (activeLocation) refresh({force: true});
  }

  return {refresh: () => refresh({force: true}), destroy: () => windowRef.clearInterval(timer)};
}
