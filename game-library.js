import {gameCatalog, gameStatuses} from './game-library-data.js';

const favoritesStorageKey = 'lipoip-game-library-v1';
const grid = document.getElementById('game-library-grid');
const status = document.getElementById('game-library-status');
const searchInput = document.getElementById('game-library-search');
const categorySelect = document.getElementById('game-library-category');
const favoritesFilter = document.getElementById('game-library-favorites');
const favoriteIds = new Set(gameCatalog.map(game => game.id));
let favorites = readFavorites();
let favoritesOnly = false;

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesStorageKey) || 'null');
    if (!Array.isArray(saved?.favorites)) return new Set();
    return new Set(saved.favorites.filter(id => favoriteIds.has(id)));
  } catch (_) { return new Set(); }
}

function saveFavorites() {
  try {
    localStorage.setItem(favoritesStorageKey, JSON.stringify({favorites: [...favorites]}));
    return true;
  } catch (_) { return false; }
}

function searchable(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
}

function fillCategories() {
  const categories = [...new Set(gameCatalog.map(game => game.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  }
}

function gameStatusBadge(game, className = 'game-library-status-badge') {
  const badge = document.createElement('span');
  badge.className = className;
  badge.dataset.status = game.status;
  badge.textContent = gameStatuses[game.status] || 'Statut inconnu';
  return badge;
}

function hasLaunchDestination(game) {
  if (game.status !== 'available') return false;
  if (game.launch?.type === 'button') return !!document.getElementById(game.launch.targetId);
  return game.launch?.type === 'url' && typeof game.launch.url === 'string' && game.launch.url.length > 0;
}

function createGameCard(game) {
  const card = document.createElement('article');
  card.className = 'game-library-card';

  const art = document.createElement('div');
  art.className = 'game-library-art';
  const image = document.createElement('img');
  image.src = game.illustration;
  image.alt = `Illustration de ${game.name}`;
  image.loading = 'lazy';
  image.onerror = () => { image.hidden = true; art.classList.add('game-library-art--missing'); };
  art.append(image);

  const category = document.createElement('span');
  category.className = 'game-library-category-chip';
  category.textContent = game.category;
  art.append(category);

  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = 'game-library-favorite';
  favorite.dataset.favoriteId = game.id;
  favorite.setAttribute('aria-pressed', String(favorites.has(game.id)));
  favorite.setAttribute('aria-label', `${favorites.has(game.id) ? 'Retirer des' : 'Ajouter aux'} favoris : ${game.name}`);
  favorite.textContent = favorites.has(game.id) ? '♥' : '♡';
  art.append(favorite);

  const body = document.createElement('div');
  body.className = 'game-library-card-body';
  const topline = document.createElement('div');
  topline.className = 'game-library-card-topline';
  const title = document.createElement('h3');
  title.textContent = game.name;
  topline.append(title, gameStatusBadge(game));

  const description = document.createElement('p');
  description.className = 'game-library-description';
  description.textContent = game.description;

  const features = document.createElement('ul');
  features.className = 'game-library-features';
  for (const feature of game.features || []) {
    const item = document.createElement('li');
    item.textContent = feature;
    features.append(item);
  }

  const actions = document.createElement('div');
  actions.className = 'game-library-card-actions';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'game-library-play';
  play.dataset.playId = game.id;
  play.disabled = !hasLaunchDestination(game);
  play.append(document.createTextNode(game.status === 'available' ? 'Jouer' : gameStatuses[game.status] || 'Indisponible'));
  if (game.status === 'available') {
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    play.append(arrow);
  }

  actions.append(play);
  body.append(topline, description, features, actions);
  card.append(art, body);
  return card;
}

function renderLibrary(message = '') {
  const query = searchable(searchInput.value.trim());
  const category = categorySelect.value;
  const visibleGames = gameCatalog.filter(game => {
    const matchesSearch = !query || searchable([game.name, game.description, game.category].join(' ')).includes(query);
    return matchesSearch && (!category || game.category === category) && (!favoritesOnly || favorites.has(game.id));
  });

  grid.replaceChildren();
  if (visibleGames.length) {
    for (const game of visibleGames) grid.append(createGameCard(game));
  } else {
    const empty = document.createElement('p');
    empty.className = 'game-library-empty';
    empty.textContent = favoritesOnly && favorites.size === 0
      ? 'Aucun favori pour le moment. Ajoute un jeu à ta collection avec le cœur.'
      : 'Aucun jeu ne correspond à ces filtres.';
    grid.append(empty);
  }

  const count = visibleGames.length;
  status.textContent = `${count} jeu${count === 1 ? '' : 'x'} dans la sélection.${message ? ` ${message}` : ''}`;
  favoritesFilter.setAttribute('aria-pressed', String(favoritesOnly));
}

function launchGame(id) {
  const game = gameCatalog.find(item => item.id === id);
  if (!game || !hasLaunchDestination(game)) return false;
  const launch = () => {
    if (game.launch.type === 'button') {
      const target = document.getElementById(game.launch.targetId);
      if (!target) return false;
      target.click();
      return true;
    }
    if (game.launch.type === 'url') {
      window.location.assign(game.launch.url);
      return true;
    }
    return false;
  };

  const libraryModal = document.getElementById('modal-bibliotheque');
  if (libraryModal?.classList.contains('is-open')) {
    libraryModal.querySelector('.close-modal')?.click();
    requestAnimationFrame(() => {
      if (!launch()) status.textContent = 'Le jeu n’a pas pu être ouvert depuis cette page.';
    });
  } else if (!launch()) status.textContent = 'Le jeu n’a pas pu être ouvert depuis cette page.';
  return true;
}

grid.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.favoriteId) {
    const id = target.dataset.favoriteId;
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    const saved = saveFavorites();
    renderLibrary(saved ? 'Favoris enregistrés.' : 'Favori conservé pour cette visite, mais le navigateur n’a pas pu le sauvegarder.');
  } else if (target.dataset.playId) {
    launchGame(target.dataset.playId);
  }
});

searchInput.addEventListener('input', () => renderLibrary());
categorySelect.addEventListener('change', () => renderLibrary());
favoritesFilter.addEventListener('click', () => { favoritesOnly = !favoritesOnly; renderLibrary(); });

fillCategories();
renderLibrary();
