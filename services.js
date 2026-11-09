// Registre centralisé des services Maccabi Sarcelles.
// Pour ajouter un nouveau service à la page d'accueil et au menu,
// ajoute simplement un objet dans le tableau SERVICES ci-dessous.

import { MACCABI_LOGO } from './logo-maccabi.js';

export const CATEGORIES = [
  { id: 'tous', label: 'Tous les services' },
  { id: 'apres-match', label: 'Fin de match & Résultats' },
  { id: 'avant-match', label: 'Avant-match' },
];

export const SERVICES = [
  {
    id: 'banderole-score',
    titre: 'Banderole Score',
    categorie: 'apres-match',
    badge: 'Photo + Overlay',
    description: 'Importe une photo de la fin du match, ajuste le cadrage et applique la banderole officielle du score par-dessus (ou exporte la banderole seule).',
    url: 'banderole-score.html',
    points: [
      'Import de photo de fin de match avec recadrage & zoom',
      'Superposition automatique de la banderole de score en bas de la photo',
      'Formats Post 4:5, Carré 1:1, Story 9:16, Photo d’origine ou Banderole seule',
    ],
    statut: 'actif',
  },
  {
    id: 'weekend-match',
    titre: 'Affiche Weekend Match',
    categorie: 'avant-match',
    badge: 'FFBB Auto',
    description: 'Récupère automatiquement les matchs du week-end sur le site FFBB et génère l’affiche officielle (Story 9:16 ou Post 4:5) prête à télécharger en PNG.',
    url: 'weekend-match.html',
    points: [
      'Synchronisation directe avec competitions.ffbb.com',
      'Formats Story 9:16 (1080 × 1900) et Post 4:5 (1080 × 1350)',
      'Édition des noms, horaires, gymnases et badges officiels',
    ],
    statut: 'actif',
  },
  {
    id: 'gameday',
    titre: 'Affiche Game Day',
    categorie: 'avant-match',
    badge: 'Match + Joueur',
    description: 'Génère l’affiche individuelle d’un match à partir du site FFBB avec remplissage automatique (logos clubs, salle, date/heure) et photo du joueur recadrable.',
    url: 'gameday.html',
    points: [
      'Sélection d’un match FFBB avec logos des clubs et de la compétition',
      'Photo du joueur détourée remplaçable et recadrable au doigt',
      'Export PNG Haute Définition (1554 × 2764) ou SVG vectoriel',
    ],
    statut: 'actif',
  },
];

export function mountTopNav(activeId = 'accueil') {
  const nav = document.createElement('nav');
  nav.className = 'ms-topnav';
  nav.setAttribute('aria-label', 'Navigation principale des services');

  const linksHtml = [
    `<a href="index.html" class="ms-nav-link ${activeId === 'accueil' ? 'active' : ''}" ${activeId === 'accueil' ? 'aria-current="page"' : ''}>Accueil</a>`,
    ...SERVICES.filter(s => s.statut === 'actif').map(s =>
      `<a href="${s.url}" class="ms-nav-link ${activeId === s.id ? 'active' : ''}" ${activeId === s.id ? 'aria-current="page"' : ''}>${s.titre}</a>`
    ),
  ].join('');

  nav.innerHTML = `
    <div class="ms-topnav-inner">
      <a href="index.html" class="ms-brand">
        <img src="${MACCABI_LOGO}" alt="">
        <span>Maccabi Sarcelles <b>· Outils</b></span>
      </a>
      <div class="ms-nav-links">
        ${linksHtml}
      </div>
    </div>
  `;

  document.body.prepend(nav);
}
