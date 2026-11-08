// Ajouter un jeu en ajoutant une entrée autonome à ce catalogue.
// launch.type vaut "button" (réutilise un contrôle existant) ou "url" (ouvre une page de jeu).
export const gameCatalog = [
  {
    id: 'infinite-night',
    name: 'INFINITE NIGHT',
    description: 'Tiens au cœur d’une arène gothique, récupère des reliques et bats ton record dans une nuit sans fin.',
    illustration: 'infinite-night/cover.svg',
    category: 'Survie',
    status: 'available',
    features: [
      'Survie en arène sans durée maximale imposée.',
      'Déplacement au clavier ou au joystick tactile.',
      'Reliques à choisir au fil des niveaux.',
      'Historique et meilleurs scores conservés localement.'
    ],
    launch: {type: 'url', url: 'infinite-night-test.html'}
  }
];

export const gameStatuses = {
  available: 'Disponible',
  development: 'En développement',
  'coming-soon': 'Bientôt disponible'
};
