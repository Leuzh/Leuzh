import {
  clearRecovery, createDefaultState, exportJson, loadState, parseImportJson,
  readRecovery, saveState
} from './storage.mjs';
import {applyLayout, detectOrientation, watchOrientation} from './layouts.mjs';
import {initWeatherWidget} from './weather.mjs';
import {initBatteryWidget} from './battery.mjs';
import {initAudioWidget} from './audio.mjs';
import {initFragmentsWidget} from './fragments.mjs';

const clock = document.getElementById('nexus-clock');
const date = document.getElementById('nexus-date');
const status = document.getElementById('nexus-status');
const fullscreenButton = document.getElementById('fullscreen-button');
const settingsButton = document.getElementById('settings-button');
const settingsDialog = document.getElementById('settings-dialog');
const closeSettingsButton = document.getElementById('close-settings');
const timeFormatSelect = document.getElementById('time-format');
const fragmentRotationInput = document.getElementById('fragment-rotation');
const fragmentIntervalSelect = document.getElementById('fragment-interval');
const activeLayoutLabel = document.getElementById('active-layout');
const settingsFeedback = document.getElementById('settings-feedback');
const importInput = document.getElementById('import-config');
const recoveryPanel = document.getElementById('recovery-panel');
const recoveryDescription = document.getElementById('recovery-description');
const grid = document.getElementById('nexus-grid');
const widgetsButton = document.getElementById('widgets-button');
const widgetEditorDialog = document.getElementById('widget-editor-dialog');
const closeWidgetEditorButton = document.getElementById('close-widget-editor');
const widgetLayoutMode = document.getElementById('widget-layout-mode');
const widgetEditorList = document.getElementById('widget-editor-list');
const widgetEditorFeedback = document.getElementById('widget-editor-feedback');
const widgetNames = {
  weather: 'Atmosphère', battery: 'Énergie', audio: 'Résonance', fragments: 'Fragments du jour'
};
let widgetEditorOrientation = 'portrait';

let storage = null;
try { storage = window.localStorage; } catch (_) {}
const loaded = loadState(storage);
let state = loaded.state;
let orientation = detectOrientation(window);
widgetEditorOrientation = orientation;
let clockTimer = 0;
let fragmentsWidget = null;

function say(message) {
  status.textContent = message;
  settingsFeedback.textContent = message;
}

function paintClock() {
  const now = new Date();
  clock.textContent = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', hour12: state.preferences.timeFormat === '12'
  }).format(now);
  date.textContent = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(now);
}

function updateClock() {
  window.clearTimeout(clockTimer);
  paintClock();
  clockTimer = window.setTimeout(updateClock, 1000 - (Date.now() % 1000));
}

function refreshRecoveryPanel() {
  const recovery = readRecovery(storage);
  recoveryPanel.hidden = !recovery;
  if (recovery) {
    recoveryDescription.textContent = `${recovery.reason} La copie d’origine reste dans le stockage NEXUS et peut être téléchargée.`;
  }
}

function refreshSettings() {
  timeFormatSelect.value = state.preferences.timeFormat;
  fragmentRotationInput.checked = state.widgets.fragments.rotationEnabled;
  fragmentIntervalSelect.value = String(state.widgets.fragments.intervalSeconds);
  activeLayoutLabel.textContent = orientation === 'portrait' ? 'Portrait' : 'Paysage';
  applyLayout(grid, state.layouts, orientation);
  refreshRecoveryPanel();
  fragmentsWidget?.refresh();
  if (widgetEditorDialog?.open) renderWidgetEditor();
}

function updateWidgetLayout(widgetId, patch) {
  const layout = state.layouts[widgetEditorOrientation];
  const widgets = {...layout.widgets, [widgetId]: {...layout.widgets[widgetId], ...patch}};
  const layouts = {...state.layouts, [widgetEditorOrientation]: {...layout, widgets}};
  commit({...state, layouts}, `Réglages de ${widgetNames[widgetId]} enregistrés.`);
}

function moveWidget(widgetId, delta) {
  const layout = state.layouts[widgetEditorOrientation];
  const order = [...layout.order];
  const index = order.indexOf(widgetId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  const layouts = {...state.layouts, [widgetEditorOrientation]: {...layout, order}};
  commit({...state, layouts}, `Ordre des widgets enregistré.`);
}

function makeEditorSelect(labelText, value, options, onChange) {
  const label = document.createElement('label');
  label.append(document.createTextNode(labelText));
  const select = document.createElement('select');
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionLabel;
    select.append(option);
  }
  select.value = String(value);
  select.addEventListener('change', () => onChange(select.value));
  label.append(select);
  return label;
}

function renderWidgetEditor(focusWidget = '') {
  if (!widgetEditorList) return;
  widgetLayoutMode.value = widgetEditorOrientation;
  const layout = state.layouts[widgetEditorOrientation];
  widgetEditorList.replaceChildren();
  for (const [index, id] of layout.order.entries()) {
    const settings = layout.widgets[id];
    const row = document.createElement('section');
    row.className = 'nexus-widget-editor-row';
    row.dataset.editorWidget = id;

    const name = document.createElement('div');
    name.className = 'nexus-widget-editor-name';
    const title = document.createElement('strong');
    title.textContent = widgetNames[id];
    const hint = document.createElement('small');
    hint.textContent = `Position ${index + 1} sur ${layout.order.length}`;
    name.append(title, hint);

    const controls = document.createElement('div');
    controls.className = 'nexus-widget-editor-controls';

    const visibilityLabel = document.createElement('label');
    visibilityLabel.append(document.createTextNode('Visible'));
    const visibility = document.createElement('input');
    visibility.type = 'checkbox';
    visibility.className = 'nexus-checkbox';
    visibility.checked = settings.visible;
    visibility.setAttribute('aria-label', `Afficher ${widgetNames[id]}`);
    visibility.addEventListener('change', () => updateWidgetLayout(id, {visible: visibility.checked}));
    visibilityLabel.append(visibility);

    const maxSpan = widgetEditorOrientation === 'landscape' ? 3 : 2;
    const widthOptions = [['1', '1 colonne'], ['2', widgetEditorOrientation === 'landscape' ? '2 colonnes' : 'Pleine largeur']];
    if (maxSpan === 3) widthOptions.push(['3', '3 colonnes']);
    const width = makeEditorSelect('Largeur', Math.min(settings.span, maxSpan), widthOptions,
      value => updateWidgetLayout(id, {span: Number(value)}));
    const height = makeEditorSelect('Hauteur', settings.size, [
      ['compact', 'Compacte'], ['standard', 'Normale'], ['expanded', 'Étendue']
    ], value => updateWidgetLayout(id, {size: value}));

    const order = document.createElement('div');
    order.className = 'nexus-widget-order';
    const up = document.createElement('button');
    up.type = 'button'; up.textContent = '↑'; up.disabled = index === 0;
    up.setAttribute('aria-label', `Déplacer ${widgetNames[id]} vers le haut`);
    up.addEventListener('click', () => moveWidget(id, -1));
    const down = document.createElement('button');
    down.type = 'button'; down.textContent = '↓'; down.disabled = index === layout.order.length - 1;
    down.setAttribute('aria-label', `Déplacer ${widgetNames[id]} vers le bas`);
    down.addEventListener('click', () => moveWidget(id, 1));
    order.append(up, down);

    controls.append(visibilityLabel, width, height, order);
    row.append(name, controls);
    widgetEditorList.append(row);
  }
  if (focusWidget) {
    const row = widgetEditorList.querySelector(`[data-editor-widget="${focusWidget}"]`);
    row?.scrollIntoView({block: 'nearest'});
    row?.querySelector('input, select, button')?.focus({preventScroll: true});
  }
  widgetEditorFeedback.textContent = `Modification de la disposition ${widgetEditorOrientation === 'portrait' ? 'portrait' : 'paysage'}. Les changements sont enregistrés automatiquement.`;
}

function openWidgetEditor(focusWidget = '') {
  if (typeof widgetEditorDialog.showModal !== 'function') {
    say('L’éditeur de widgets n’est pas pris en charge par ce navigateur.');
    return;
  }
  widgetEditorOrientation = orientation;
  widgetLayoutMode.value = widgetEditorOrientation;
  renderWidgetEditor();
  if (!widgetEditorDialog.open) widgetEditorDialog.showModal();
  if (focusWidget) {
    const row = widgetEditorList.querySelector(`[data-editor-widget="${focusWidget}"]`);
    row?.scrollIntoView({block: 'nearest'});
    row?.querySelector('input, select, button')?.focus({preventScroll: true});
  }
}

widgetsButton.addEventListener('click', () => openWidgetEditor());
closeWidgetEditorButton.addEventListener('click', () => widgetEditorDialog.close());
widgetEditorDialog.addEventListener('click', event => {
  if (event.target === widgetEditorDialog) widgetEditorDialog.close();
});
widgetLayoutMode.addEventListener('change', () => {
  widgetEditorOrientation = widgetLayoutMode.value;
  renderWidgetEditor();
});
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-widget-edit]');
  if (button) openWidgetEditor(button.dataset.widgetEdit);
});

function syncFullscreenButton() {
  const active = document.fullscreenElement === document.documentElement;
  fullscreenButton.setAttribute('aria-label', active ? 'Quitter le plein écran' : 'Passer en plein écran');
  const label = fullscreenButton.querySelector('span');
  if (label) label.textContent = active ? 'Quitter' : 'Plein écran';
}

function commit(candidate, successMessage) {
  const result = saveState(storage, candidate);
  if (!result.ok) {
    say(result.reason);
    refreshSettings();
    return false;
  }
  state = result.state;
  refreshSettings();
  paintClock();
  say(successMessage);
  return true;
}

function downloadText(filename, text, type = 'application/json') {
  try {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (_) {
    say('Le téléchargement n’a pas pu être préparé dans ce navigateur.');
    return false;
  }
}

settingsButton.addEventListener('click', () => {
  if (typeof settingsDialog.showModal !== 'function') {
    say('La fenêtre de réglages n’est pas prise en charge par ce navigateur.');
    return;
  }
  refreshSettings();
  if (!settingsDialog.open) settingsDialog.showModal();
  timeFormatSelect.focus();
});

closeSettingsButton.addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', event => {
  if (event.target === settingsDialog) settingsDialog.close();
});
timeFormatSelect.addEventListener('change', () => {
  commit({...state, preferences: {timeFormat: timeFormatSelect.value}}, 'Préférence enregistrée.');
});
fragmentRotationInput.addEventListener('change', () => {
  const fragments = {...state.widgets.fragments, rotationEnabled: fragmentRotationInput.checked};
  commit({...state, widgets: {...state.widgets, fragments}}, 'Préférence des fragments enregistrée.');
});
fragmentIntervalSelect.addEventListener('change', () => {
  const fragments = {...state.widgets.fragments, intervalSeconds: Number(fragmentIntervalSelect.value)};
  commit({...state, widgets: {...state.widgets, fragments}}, 'Intervalle des fragments enregistré.');
});

document.getElementById('export-config').addEventListener('click', () => {
  const day = new Date().toISOString().slice(0, 10);
  if (downloadText(`nexus-configuration-${day}.json`, exportJson(state))) say('Configuration exportée.');
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    say('Le fichier dépasse la taille autorisée de 1 Mo.');
    importInput.value = '';
    return;
  }
  try {
    const imported = parseImportJson(await file.text());
    if (!imported.ok) {
      say(imported.reason);
      return;
    }
    if (!window.confirm('Remplacer les préférences et les deux dispositions NEXUS par celles de ce fichier ?')) {
      say('Import annulé ; la configuration actuelle est conservée.');
      return;
    }
    commit(imported.state, 'Configuration importée et appliquée.');
  } catch (_) {
    say('Le fichier n’a pas pu être lu. La configuration actuelle est conservée.');
  } finally {
    importInput.value = '';
  }
});

document.getElementById('reset-config').addEventListener('click', () => {
  if (!window.confirm('Réinitialiser les préférences et les dispositions NEXUS sur cet appareil ?')) return;
  commit(createDefaultState(), 'Configuration NEXUS réinitialisée.');
});

document.getElementById('export-recovery').addEventListener('click', () => {
  const recovery = readRecovery(storage);
  if (!recovery) {
    refreshRecoveryPanel();
    say('Aucune copie de récupération n’est disponible.');
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  if (downloadText(`nexus-recuperation-${day}.json`, JSON.stringify(recovery, null, 2))) {
    say('Copie de récupération téléchargée. Elle peut contenir une configuration illisible.');
  }
});

document.getElementById('clear-recovery').addEventListener('click', () => {
  if (!window.confirm('Effacer définitivement la copie de récupération NEXUS ?')) return;
  say(clearRecovery(storage) ? 'Copie de récupération effacée.' : 'La copie de récupération n’a pas pu être effacée.');
  refreshRecoveryPanel();
});

fullscreenButton.addEventListener('click', async () => {
  if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
    say('Le plein écran n’est pas disponible dans ce navigateur.');
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    say('');
  } catch (_) {
    say('Le navigateur n’a pas autorisé le plein écran.');
  }
});

watchOrientation(nextOrientation => {
  if (nextOrientation === orientation) return;
  orientation = nextOrientation;
  refreshSettings();
});
document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateClock();
});

const fragmentsDialog = document.getElementById('fragments-dialog');
fragmentsWidget = initFragmentsWidget({
  documentRef: document,
  windowRef: window,
  getState: () => state,
  commit
});
initWeatherWidget({
  documentRef: document,
  windowRef: window,
  storage,
  getState: () => state,
  commit
});
initBatteryWidget({navigatorRef: navigator, documentRef: document});
initAudioWidget({documentRef: document});

refreshSettings();
syncFullscreenButton();
updateClock();
if (loaded.warning) say(loaded.warning);
