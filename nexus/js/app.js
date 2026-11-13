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

let storage = null;
try { storage = window.localStorage; } catch (_) {}
const loaded = loadState(storage);
let state = loaded.state;
let orientation = detectOrientation(window);
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
}

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
