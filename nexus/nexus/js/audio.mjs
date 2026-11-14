export const AUDIO_DATABASE_NAME = 'nexus.ambient.v1';
export const AUDIO_OBJECT_STORE = 'tracks';
const TRACK_ID = 'current';

export function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function isAudioFile(file) {
  if (!file || typeof file.name !== 'string') return false;
  if (typeof file.type === 'string' && file.type.toLowerCase().startsWith('audio/')) return true;
  return /\.(aac|aif|aiff|alac|amr|flac|m4a|mid|midi|mp3|oga|ogg|opus|wav|weba|webm)$/i.test(file.name);
}

function openDatabase(indexedDBRef) {
  return new Promise((resolve, reject) => {
    if (!indexedDBRef?.open) return reject(new Error('Le stockage audio local n’est pas pris en charge.'));
    let request;
    try { request = indexedDBRef.open(AUDIO_DATABASE_NAME, 1); }
    catch (error) { reject(error); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_OBJECT_STORE)) db.createObjectStore(AUDIO_OBJECT_STORE, {keyPath: 'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossible d’ouvrir le stockage audio.'));
    request.onblocked = () => reject(new Error('Le stockage audio est bloqué par un autre onglet.'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Opération de stockage audio échouée.'));
  });
}

async function getTrack(indexedDBRef) {
  const db = await openDatabase(indexedDBRef);
  try {
    const tx = db.transaction(AUDIO_OBJECT_STORE, 'readonly');
    return await requestValue(tx.objectStore(AUDIO_OBJECT_STORE).get(TRACK_ID));
  } finally { db.close(); }
}

async function putTrack(indexedDBRef, file) {
  const db = await openDatabase(indexedDBRef);
  try {
    const tx = db.transaction(AUDIO_OBJECT_STORE, 'readwrite');
    const complete = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Écriture audio refusée.'));
      tx.onabort = () => reject(tx.error || new Error('Écriture audio annulée.'));
    });
    tx.objectStore(AUDIO_OBJECT_STORE).put({id: TRACK_ID, name: file.name, type: file.type || '', blob: file});
    await complete;
  } finally { db.close(); }
}

async function deleteTrack(indexedDBRef) {
  const db = await openDatabase(indexedDBRef);
  try {
    const tx = db.transaction(AUDIO_OBJECT_STORE, 'readwrite');
    const complete = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Suppression audio refusée.'));
      tx.onabort = () => reject(tx.error || new Error('Suppression audio annulée.'));
    });
    tx.objectStore(AUDIO_OBJECT_STORE).delete(TRACK_ID);
    await complete;
  } finally { db.close(); }
}

export function initAudioWidget({documentRef = document, indexedDBRef = globalThis.indexedDB, urlRef = URL} = {}) {
  const audio = documentRef.getElementById('nexus-audio');
  const fileInput = documentRef.getElementById('audio-file');
  const trackName = documentRef.getElementById('audio-track-name');
  const status = documentRef.getElementById('audio-status');
  const playButton = documentRef.getElementById('audio-play');
  const pauseButton = documentRef.getElementById('audio-pause');
  const stopButton = documentRef.getElementById('audio-stop');
  const removeButton = documentRef.getElementById('audio-remove');
  const seek = documentRef.getElementById('audio-seek');
  const currentTime = documentRef.getElementById('audio-current-time');
  const duration = documentRef.getElementById('audio-duration');
  let objectUrl = '';
  let hasTrack = false;
  let destroyed = false;

  function updateControls() {
    playButton.disabled = !hasTrack;
    pauseButton.disabled = !hasTrack;
    stopButton.disabled = !hasTrack;
    seek.disabled = !hasTrack || !Number.isFinite(audio.duration) || audio.duration <= 0;
  }

  function updateProgress() {
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    currentTime.textContent = formatAudioTime(audio.currentTime);
    duration.textContent = formatAudioTime(total);
    if (total) seek.value = String(Math.round((audio.currentTime / total) * 1000));
    updateControls();
  }

  function setTrack(blob, name, message) {
    const nextObjectUrl = urlRef.createObjectURL(blob);
    if (objectUrl) urlRef.revokeObjectURL(objectUrl);
    objectUrl = nextObjectUrl;
    audio.pause();
    audio.src = objectUrl;
    audio.load();
    hasTrack = true;
    trackName.textContent = name;
    status.textContent = message;
    seek.value = '0';
    currentTime.textContent = '00:00';
    duration.textContent = '00:00';
    updateControls();
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!isAudioFile(file)) {
      status.textContent = 'Ce fichier ne semble pas être un fichier audio pris en charge.';
      fileInput.value = '';
      return;
    }
    try { setTrack(file, file.name, 'Fichier local · prêt à écouter. Aucun envoi réseau.'); }
    catch (_) {
      status.textContent = 'Le navigateur n’a pas pu ouvrir ce fichier audio.';
      fileInput.value = '';
      return;
    }
    try {
      await putTrack(indexedDBRef, file);
      status.textContent = 'Fichier local mémorisé sur cet appareil. Aucun envoi réseau.';
      removeButton.hidden = false;
    } catch (_) {
      status.textContent = 'Lecture locale disponible pour cette visite, mais mémorisation impossible.';
      removeButton.hidden = true;
    }
    fileInput.value = '';
  });

  playButton.addEventListener('click', async () => {
    if (!hasTrack) return;
    try { await audio.play(); status.textContent = 'Lecture en cours · fichier local.'; }
    catch (_) { status.textContent = 'Lecture bloquée ou format audio non pris en charge par ce navigateur.'; }
  });
  pauseButton.addEventListener('click', () => {
    if (!hasTrack) return;
    audio.pause();
    status.textContent = 'Lecture en pause.';
  });
  stopButton.addEventListener('click', () => {
    if (!hasTrack) return;
    audio.pause();
    try { audio.currentTime = 0; } catch (_) {}
    updateProgress();
    status.textContent = 'Lecture arrêtée.';
  });
  removeButton.addEventListener('click', async () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) urlRef.revokeObjectURL(objectUrl);
    objectUrl = '';
    hasTrack = false;
    trackName.textContent = 'Aucun fichier sélectionné';
    status.textContent = 'Fichier audio retiré de cet appareil.';
    removeButton.hidden = true;
    seek.value = '0';
    updateProgress();
    try { await deleteTrack(indexedDBRef); }
    catch (_) { status.textContent = 'Fichier retiré de la lecture, mais le stockage n’a pas pu être effacé.'; }
  });

  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
      updateProgress();
    }
  });
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('durationchange', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('play', () => { status.textContent = 'Lecture en cours · fichier local.'; });
  audio.addEventListener('pause', () => { if (hasTrack && !audio.ended) status.textContent = 'Lecture en pause.'; });
  audio.addEventListener('ended', () => { status.textContent = 'Lecture terminée.'; updateProgress(); });
  audio.addEventListener('error', () => {
    if (hasTrack) status.textContent = 'Erreur de lecture. Vérifie le fichier ou essaie un autre format.';
  });

  getTrack(indexedDBRef).then(record => {
    if (destroyed || !record || !(record.blob instanceof Blob) || typeof record.name !== 'string') return;
    setTrack(record.blob, record.name, 'Fichier local restauré depuis cet appareil. Aucun envoi réseau.');
    removeButton.hidden = false;
  }).catch(() => {
    if (!destroyed) status.textContent = 'Aucun fichier mémorisé, ou le stockage audio est indisponible.';
  });

  return () => {
    destroyed = true;
    audio.pause();
    if (objectUrl) urlRef.revokeObjectURL(objectUrl);
  };
}
