export const BUILT_IN_FRAGMENTS = Object.freeze([
  'Chaque monde commence par une porte.',
  'La nuit garde une place pour les étoiles.',
  'Un instant de calme peut déplacer tout un horizon.',
  'Les chemins discrets savent aussi mener très loin.',
  'Une pensée semée aujourd’hui peut devenir un refuge demain.',
  'Même la brume laisse passer une lueur.',
  'Prends le temps d’habiter ce qui compte.',
  'Les petites constellations finissent par dessiner une route.'
]);

export function normalizeFragmentText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 500);
}

function makeId(cryptoRef = globalThis.crypto) {
  try { if (cryptoRef?.randomUUID) return cryptoRef.randomUUID(); } catch (_) {}
  return `fragment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initFragmentsWidget({documentRef = document, windowRef = window, getState, commit}) {
  const currentText = documentRef.getElementById('fragment-current');
  const counter = documentRef.getElementById('fragment-counter');
  const manageButton = documentRef.getElementById('manage-fragments');
  const dialog = documentRef.getElementById('fragments-dialog');
  const closeButton = documentRef.getElementById('close-fragments');
  const form = documentRef.getElementById('fragment-form');
  const textarea = documentRef.getElementById('fragment-text');
  const saveButton = documentRef.getElementById('fragment-save');
  const cancelEditButton = documentRef.getElementById('fragment-cancel-edit');
  const formFeedback = documentRef.getElementById('fragment-form-feedback');
  const list = documentRef.getElementById('fragment-list');
  let quoteIndex = 0;
  let rotationTimer = 0;
  let editingId = '';

  function phrases() {
    return [...BUILT_IN_FRAGMENTS, ...getState().widgets.fragments.customQuotes.map(quote => quote.text)];
  }

  function paintQuote() {
    const all = phrases();
    if (!all.length) return;
    quoteIndex %= all.length;
    currentText.textContent = `« ${all[quoteIndex]} »`;
    counter.textContent = `${quoteIndex + 1} / ${all.length} · ${getState().widgets.fragments.rotationEnabled ? 'rotation active' : 'rotation en pause'}`;
  }

  function restartRotation() {
    windowRef.clearInterval(rotationTimer);
    rotationTimer = 0;
    const settings = getState().widgets.fragments;
    paintQuote();
    if (settings.rotationEnabled && phrases().length > 1) {
      rotationTimer = windowRef.setInterval(() => {
        quoteIndex = (quoteIndex + 1) % phrases().length;
        paintQuote();
      }, settings.intervalSeconds * 1000);
    }
  }

  function resetForm() {
    editingId = '';
    form.reset();
    saveButton.textContent = 'Ajouter';
    cancelEditButton.hidden = true;
  }

  function editFragment(id) {
    const item = getState().widgets.fragments.customQuotes.find(quote => quote.id === id);
    if (!item) return;
    editingId = id;
    textarea.value = item.text;
    saveButton.textContent = 'Enregistrer';
    cancelEditButton.hidden = false;
    formFeedback.textContent = 'Modification de cette phrase.';
    textarea.focus();
  }

  function renderList() {
    list.replaceChildren();
    const quotes = getState().widgets.fragments.customQuotes;
    if (!quotes.length) {
      const empty = documentRef.createElement('li');
      empty.className = 'nexus-fragment-empty';
      empty.textContent = 'Tu n’as pas encore ajouté de phrase personnelle.';
      list.append(empty);
      return;
    }
    for (const quote of quotes) {
      const item = documentRef.createElement('li');
      const textBlock = documentRef.createElement('div');
      const text = documentRef.createElement('p');
      text.textContent = quote.text;
      const label = documentRef.createElement('small');
      label.textContent = 'Phrase personnelle';
      textBlock.append(text, label);
      const actions = documentRef.createElement('div');
      actions.className = 'nexus-fragment-actions';
      const edit = documentRef.createElement('button');
      edit.type = 'button'; edit.className = 'nexus-small-button'; edit.dataset.fragmentAction = 'edit'; edit.dataset.fragmentId = quote.id; edit.textContent = 'Modifier';
      const remove = documentRef.createElement('button');
      remove.type = 'button'; remove.className = 'nexus-small-button'; remove.dataset.fragmentAction = 'remove'; remove.dataset.fragmentId = quote.id; remove.textContent = 'Supprimer';
      actions.append(edit, remove);
      item.append(textBlock, actions);
      list.append(item);
    }
  }

  function showDialog() {
    renderList();
    if (!dialog.open) dialog.showModal();
    textarea.focus();
  }

  manageButton.addEventListener('click', showDialog);
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', resetForm);
  cancelEditButton.addEventListener('click', () => { resetForm(); formFeedback.textContent = ''; });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = normalizeFragmentText(textarea.value);
    if (!text) { formFeedback.textContent = 'Écris une phrase avant de l’enregistrer.'; return; }
    const current = getState();
    const customQuotes = [...current.widgets.fragments.customQuotes];
    if (editingId) {
      const index = customQuotes.findIndex(quote => quote.id === editingId);
      if (index < 0) { formFeedback.textContent = 'Cette phrase n’existe plus.'; resetForm(); return; }
      customQuotes[index] = {...customQuotes[index], text};
    } else {
      if (customQuotes.length >= 100) { formFeedback.textContent = 'La collection contient déjà 100 phrases personnelles.'; return; }
      customQuotes.push({id: makeId(windowRef.crypto), text});
    }
    const success = commit({...current, widgets: {...current.widgets, fragments: {...current.widgets.fragments, customQuotes}}}, editingId ? 'Phrase modifiée.' : 'Phrase ajoutée.');
    if (success) {
      formFeedback.textContent = editingId ? 'Phrase modifiée.' : 'Phrase ajoutée.';
      resetForm();
      renderList();
      restartRotation();
    }
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-fragment-action]');
    if (!button) return;
    const {fragmentAction, fragmentId} = button.dataset;
    if (fragmentAction === 'edit') { editFragment(fragmentId); return; }
    if (fragmentAction !== 'remove') return;
    const current = getState();
    const customQuotes = current.widgets.fragments.customQuotes.filter(quote => quote.id !== fragmentId);
    if (customQuotes.length === current.widgets.fragments.customQuotes.length) return;
    if (commit({...current, widgets: {...current.widgets, fragments: {...current.widgets.fragments, customQuotes}}}, 'Phrase supprimée.')) {
      if (editingId === fragmentId) resetForm();
      formFeedback.textContent = 'Phrase supprimée.';
      renderList();
      restartRotation();
    }
  });

  restartRotation();
  return {
    refresh: () => { renderList(); restartRotation(); },
    destroy: () => windowRef.clearInterval(rotationTimer)
  };
}
