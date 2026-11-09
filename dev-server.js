// Serveur local pour tester sans Vercel :  node dev-server.js  puis http://localhost:3000
// (MOCK=chemin/vers/donnees.json pour servir des données d'exemple au lieu du site FFBB)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/matches.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};
const PORT = Number(process.env.PORT) || 3000;

function vercelRes(res) {
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  return res;
}

http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (path === '/api/matches') {
    if (process.env.MOCK) {
      res.setHeader('Content-Type', 'application/json');
      return res.end(await readFile(process.env.MOCK));
    }
    return handler(req, vercelRes(res));
  }
  const rawPath = decodeURIComponent(req.url.split('?')[0]);
  const file = normalize(join(root, rawPath === '/' ? 'index.html' : rawPath));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('404'); }
}).listen(PORT, () => console.log(`Générateur : http://localhost:${PORT}`));
