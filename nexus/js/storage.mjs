export const STATE_KEY = 'nexus.state.v3';
export const LEGACY_STATE_KEY = 'nexus.state.v2';
export const OLDER_STATE_KEY = 'nexus.state.v1';
export const RECOVERY_KEY = 'nexus.recovery.v1';
export const APP_ID = 'nexus-ambient-display';
export const SCHEMA_VERSION = 3;
export const WIDGET_IDS = Object.freeze(['weather', 'battery', 'audio', 'fragments']);
export const MAX_CUSTOM_QUOTES = 100;

const widgetIdSet = new Set(WIDGET_IDS);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, expected) => isRecord(value)
  && Object.keys(value).length === expected.length
  && expected.every(key => hasOwn(value, key));

function makeLayout(order, wideWidgets = []) {
  return {
    order: [...order],
    widgets: Object.fromEntries(WIDGET_IDS.map(id => [id, {
      visible: true,
      span: wideWidgets.includes(id) ? 2 : 1,
      size: 'standard'
    }]))
  };
}

export function createDefaultState(now = new Date()) {
  const order = [...WIDGET_IDS];
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    preferences: {timeFormat: '24'},
    widgets: {
      weather: {city: '', latitude: null, longitude: null},
      fragments: {rotationEnabled: true, intervalSeconds: 60, customQuotes: []}
    },
    layouts: {
      portrait: makeLayout(order, ['audio', 'fragments']),
      landscape: makeLayout(order)
    }
  };
}

function validateLayout(layout, name) {
  if (!exactKeys(layout, ['order', 'widgets'])) return `${name}: structure invalide.`;
  if (!Array.isArray(layout.order)
    || layout.order.length !== WIDGET_IDS.length
    || new Set(layout.order).size !== WIDGET_IDS.length
    || !layout.order.every(id => widgetIdSet.has(id))) {
    return `${name}: l’ordre doit contenir chaque widget une seule fois.`;
  }
  if (!exactKeys(layout.widgets, [...WIDGET_IDS])) return `${name}: liste de widgets invalide.`;
  for (const id of WIDGET_IDS) {
    const widget = layout.widgets[id];
    if (!exactKeys(widget, ['visible', 'span', 'size'])) return `${name}.${id}: réglage invalide.`;
    if (typeof widget.visible !== 'boolean') return `${name}.${id}: visibilité invalide.`;
    if (![1, 2, 3].includes(widget.span)) return `${name}.${id}: largeur invalide.`;
    if (!['compact', 'standard', 'expanded'].includes(widget.size)) return `${name}.${id}: hauteur invalide.`;
  }
  return '';
}

export function validateState(value) {
  if (!isRecord(value)) return {ok: false, reason: 'Le contenu doit être un objet JSON.'};
  if (value.schemaVersion !== SCHEMA_VERSION) {
    return {ok: false, reason: `Version de configuration non compatible (${String(value.schemaVersion)}).`};
  }
  if (!exactKeys(value, ['schemaVersion', 'updatedAt', 'preferences', 'widgets', 'layouts'])) {
    return {ok: false, reason: 'La configuration ne correspond pas au format NEXUS attendu.'};
  }
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) {
    return {ok: false, reason: 'La date de configuration est invalide.'};
  }
  if (!exactKeys(value.preferences, ['timeFormat'])
    || !['12', '24'].includes(value.preferences.timeFormat)) {
    return {ok: false, reason: 'Les préférences d’affichage sont invalides.'};
  }
  if (!isRecord(value.widgets)
    || !exactKeys(value.widgets, ['weather', 'fragments'])) {
    return {ok: false, reason: 'Les préférences des widgets sont invalides.'};
  }
  const weather = value.widgets.weather;
  if (!exactKeys(weather, ['city', 'latitude', 'longitude'])
    || typeof weather.city !== 'string' || weather.city.length > 120) {
    return {ok: false, reason: 'La ville météo enregistrée est invalide.'};
  }
  const coordsEmpty = weather.latitude === null && weather.longitude === null;
  const coordsValid = Number.isFinite(weather.latitude) && weather.latitude >= -90 && weather.latitude <= 90
    && Number.isFinite(weather.longitude) && weather.longitude >= -180 && weather.longitude <= 180;
  if ((!coordsEmpty && !coordsValid) || (weather.city.trim() === '') !== coordsEmpty) {
    return {ok: false, reason: 'Les coordonnées de la ville météo sont invalides.'};
  }
  const fragments = value.widgets.fragments;
  if (!exactKeys(fragments, ['rotationEnabled', 'intervalSeconds', 'customQuotes'])
    || typeof fragments.rotationEnabled !== 'boolean'
    || !Number.isInteger(fragments.intervalSeconds)
    || fragments.intervalSeconds < 10 || fragments.intervalSeconds > 300
    || !Array.isArray(fragments.customQuotes)
    || fragments.customQuotes.length > MAX_CUSTOM_QUOTES) {
    return {ok: false, reason: 'Les réglages des fragments sont invalides.'};
  }
  const quoteIds = new Set();
  for (const quote of fragments.customQuotes) {
    if (!exactKeys(quote, ['id', 'text']) || typeof quote.id !== 'string' || !quote.id.trim()
      || quote.id.length > 80 || quoteIds.has(quote.id)
      || typeof quote.text !== 'string' || !quote.text.trim() || quote.text.length > 500) {
      return {ok: false, reason: 'Une citation personnelle est invalide.'};
    }
    quoteIds.add(quote.id);
  }
  if (!exactKeys(value.layouts, ['portrait', 'landscape'])) {
    return {ok: false, reason: 'Les dispositions portrait et paysage sont requises.'};
  }
  for (const name of ['portrait', 'landscape']) {
    const reason = validateLayout(value.layouts[name], `Disposition ${name}`);
    if (reason) return {ok: false, reason};
  }

  // Rebuild the accepted shape rather than retaining references from imported JSON.
  return {
    ok: true,
    state: {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: value.updatedAt,
      preferences: {timeFormat: value.preferences.timeFormat},
      widgets: {
        weather: {city: weather.city.trim(), latitude: weather.latitude, longitude: weather.longitude},
        fragments: {
          rotationEnabled: fragments.rotationEnabled,
          intervalSeconds: fragments.intervalSeconds,
          customQuotes: fragments.customQuotes.map(quote => ({id: quote.id, text: quote.text.trim()}))
        }
      },
      layouts: Object.fromEntries(['portrait', 'landscape'].map(name => [name, {
        order: [...value.layouts[name].order],
        widgets: Object.fromEntries(WIDGET_IDS.map(id => [id, {
          visible: value.layouts[name].widgets[id].visible,
          span: value.layouts[name].widgets[id].span,
          size: value.layouts[name].widgets[id].size
        }]))
      }]))
    }
  };
}

function validateV1State(value) {
  if (!isRecord(value) || value.schemaVersion !== 1
    || !exactKeys(value, ['schemaVersion', 'updatedAt', 'preferences', 'layouts'])
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || !exactKeys(value.preferences, ['timeFormat']) || !['12', '24'].includes(value.preferences.timeFormat)
    || !exactKeys(value.layouts, ['portrait', 'landscape'])) {
    return {ok: false, reason: 'L’ancienne configuration NEXUS v1 est invalide.'};
  }
  for (const name of ['portrait', 'landscape']) {
    const layout = value.layouts[name];
    if (!exactKeys(layout, ['order', 'widgets']) || !Array.isArray(layout.order)
      || layout.order.length !== WIDGET_IDS.length
      || new Set(layout.order).size !== WIDGET_IDS.length
      || !layout.order.every(id => widgetIdSet.has(id))
      || !exactKeys(layout.widgets, [...WIDGET_IDS])) {
      return {ok: false, reason: `Disposition ${name} v1 invalide.`};
    }
    for (const id of WIDGET_IDS) {
      const widget = layout.widgets[id];
      if (!exactKeys(widget, ['visible', 'span']) || typeof widget.visible !== 'boolean'
        || ![1, 2].includes(widget.span)) return {ok: false, reason: `Réglage ${name}.${id} v1 invalide.`};
    }
  }
  return {ok: true};
}

function migrateV1State(value, now = new Date()) {
  const validation = validateV1State(value);
  if (!validation.ok) return validation;
  const defaults = createDefaultState(now);
  const layouts = Object.fromEntries(['portrait', 'landscape'].map(name => [name, {
    order: [...value.layouts[name].order],
    widgets: Object.fromEntries(WIDGET_IDS.map(id => [id, {
      visible: value.layouts[name].widgets[id].visible,
      span: value.layouts[name].widgets[id].span,
      size: 'standard'
    }]))
  }]));
  return validateState({...defaults, updatedAt: value.updatedAt,
    preferences: {...value.preferences}, layouts});
}

function migrateV2State(value) {
  if (!isRecord(value) || value.schemaVersion !== 2
    || !exactKeys(value, ['schemaVersion', 'updatedAt', 'preferences', 'widgets', 'layouts'])) {
    return {ok: false, reason: 'L’ancienne configuration NEXUS v2 est invalide.'};
  }
  const layouts = {};
  for (const name of ['portrait', 'landscape']) {
    const layout = value.layouts?.[name];
    if (!exactKeys(layout, ['order', 'widgets']) || !Array.isArray(layout.order)
      || layout.order.length !== WIDGET_IDS.length
      || new Set(layout.order).size !== WIDGET_IDS.length
      || !layout.order.every(id => widgetIdSet.has(id))
      || !exactKeys(layout.widgets, [...WIDGET_IDS])) {
      return {ok: false, reason: `Disposition ${name} v2 invalide.`};
    }
    const widgets = {};
    for (const id of WIDGET_IDS) {
      const widget = layout.widgets[id];
      if (!exactKeys(widget, ['visible', 'span']) || typeof widget.visible !== 'boolean'
        || ![1, 2].includes(widget.span)) {
        return {ok: false, reason: `Réglage ${name}.${id} v2 invalide.`};
      }
      widgets[id] = {visible: widget.visible, span: widget.span, size: 'standard'};
    }
    layouts[name] = {order: [...layout.order], widgets};
  }
  const candidate = {
    schemaVersion: 3,
    updatedAt: value.updatedAt,
    preferences: value.preferences,
    widgets: value.widgets,
    layouts
  };
  return validateState(candidate);
}

export function parseImportJson(text, maxBytes = 1024 * 1024) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > maxBytes) {
    return {ok: false, reason: 'Le fichier dépasse la taille autorisée de 1 Mo.'};
  }
  let imported;
  try { imported = JSON.parse(text); }
  catch (_) { return {ok: false, reason: 'Le fichier ne contient pas de JSON valide.'}; }
  if (!exactKeys(imported, ['format', 'schemaVersion', 'exportedAt', 'data'])
    || imported.format !== APP_ID
    || ![1, 2, SCHEMA_VERSION].includes(imported.schemaVersion)
    || typeof imported.exportedAt !== 'string'
    || !Number.isFinite(Date.parse(imported.exportedAt))) {
    return {ok: false, reason: 'Ce fichier n’est pas un export NEXUS compatible.'};
  }
  if (imported.schemaVersion === 1) return migrateV1State(imported.data);
  if (imported.schemaVersion === 2) return migrateV2State(imported.data);
  return validateState(imported.data);
}

export function exportJson(state, now = new Date()) {
  const validation = validateState(state);
  if (!validation.ok) throw new TypeError(validation.reason);
  return JSON.stringify({
    format: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data: validation.state
  }, null, 2);
}

function captureRecovery(storage, raw, reason, now, sourceKey = STATE_KEY) {
  try {
    if (storage.getItem(RECOVERY_KEY) !== null) return false;
    storage.setItem(RECOVERY_KEY, JSON.stringify({
      format: APP_ID,
      capturedAt: now.toISOString(),
      reason,
      sourceKey,
      raw
    }));
    return true;
  } catch (_) { return false; }
}

export function loadState(storage, now = new Date()) {
  let raw, sourceKey = STATE_KEY;
  try {
    raw = storage?.getItem(STATE_KEY) ?? null;
    if (raw === null) {
      raw = storage?.getItem(LEGACY_STATE_KEY) ?? null;
      sourceKey = LEGACY_STATE_KEY;
    }
    if (raw === null) {
      raw = storage?.getItem(OLDER_STATE_KEY) ?? null;
      sourceKey = OLDER_STATE_KEY;
    }
  }
  catch (_) {
    return {state: createDefaultState(now), warning: 'Le stockage local est inaccessible ; les réglages resteront temporaires.', recoverySaved: false};
  }
  if (raw === null) {
    const state = createDefaultState(now);
    const saved = saveState(storage, state, now);
    return {state: saved.ok ? saved.state : state, warning: saved.ok ? '' : saved.reason, recoverySaved: false};
  }

  let value;
  try { value = JSON.parse(raw); }
  catch (_) {
    const reason = 'La configuration locale contient un JSON endommagé.';
    const recoverySaved = captureRecovery(storage, raw, reason, now, sourceKey);
    return {state: createDefaultState(now), warning: `${reason} Une configuration vierge est chargée${recoverySaved ? ' et une copie a été conservée.' : '.'}`, recoverySaved};
  }
  if (sourceKey === LEGACY_STATE_KEY || sourceKey === OLDER_STATE_KEY) {
    const migrated = sourceKey === LEGACY_STATE_KEY
      ? migrateV2State(value)
      : migrateV1State(value, now);
    if (!migrated.ok) {
      const recoverySaved = captureRecovery(storage, raw, migrated.reason, now, sourceKey);
      return {state: createDefaultState(now), warning: `${migrated.reason} Une configuration vierge est chargée${recoverySaved ? ' et une copie a été conservée.' : '.'}`, recoverySaved};
    }
    const saved = saveState(storage, migrated.state, now);
    if (!saved.ok) return {state: migrated.state, warning: `${saved.reason} L’ancienne configuration a été gardée.`, recoverySaved: false};
    try { storage.removeItem(sourceKey); } catch (_) {}
    return {state: saved.state, warning: `Configuration précédente ${sourceKey.endsWith('v2') ? 'v2' : 'v1'} migrée vers le nouveau format.`, recoverySaved: false};
  }
  const result = validateState(value);
  if (result.ok) return {state: result.state, warning: '', recoverySaved: false};
  const recoverySaved = captureRecovery(storage, raw, result.reason, now, sourceKey);
  return {
    state: createDefaultState(now),
    warning: `${result.reason} Une configuration vierge est chargée${recoverySaved ? ' et une copie a été conservée.' : '.'}`,
    recoverySaved
  };
}

export function saveState(storage, value, now = new Date()) {
  const candidate = {...value, updatedAt: now.toISOString()};
  const validation = validateState(candidate);
  if (!validation.ok) return {ok: false, reason: validation.reason};
  try {
    if (!storage) throw new Error('storage unavailable');
    storage.setItem(STATE_KEY, JSON.stringify(validation.state));
    return {ok: true, state: validation.state};
  } catch (_) {
    return {ok: false, reason: 'Impossible d’enregistrer la configuration. Vérifie l’espace de stockage du navigateur.'};
  }
}

export function readRecovery(storage) {
  try {
    const raw = storage?.getItem(RECOVERY_KEY);
    if (raw === null || raw === undefined) return null;
    const record = JSON.parse(raw);
    if (!isRecord(record) || record.format !== APP_ID) return null;
    if (exactKeys(record, ['format', 'capturedAt', 'reason', 'raw'])) {
      return {...record, sourceKey: OLDER_STATE_KEY};
    }
    return exactKeys(record, ['format', 'capturedAt', 'reason', 'sourceKey', 'raw'])
      && [STATE_KEY, LEGACY_STATE_KEY, OLDER_STATE_KEY].includes(record.sourceKey) ? record : null;
  } catch (_) { return null; }
}

export function clearRecovery(storage) {
  try { storage?.removeItem(RECOVERY_KEY); return true; }
  catch (_) { return false; }
}
