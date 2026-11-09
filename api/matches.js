// GET /api/matches?samedi=YYYY-MM-DD&vendredi=1
import { buildWeekend } from './_build.js';

// Page du club sur competitions.ffbb.com (modifiable via la variable d'environnement CLUB_PATH)
const CLUB_PATH = process.env.CLUB_PATH || '/ligues/idf/comites/0095/clubs/idf0095045';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const samedi = url.searchParams.get('samedi');
  if (samedi && !/^\d{4}-\d{2}-\d{2}$/.test(samedi)) {
    res.status(400).json({ erreur: 'Paramètre samedi invalide (format AAAA-MM-JJ)' });
    return;
  }
  try {
    const data = await buildWeekend({
      clubPath: CLUB_PATH,
      saturday: samedi || undefined,
      includeFriday: url.searchParams.get('vendredi') === '1',
      withLogos: url.searchParams.get('logos') === '1',
    });
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ erreur: 'Impossible de lire le site FFBB : ' + (e.message || e) });
  }
}
