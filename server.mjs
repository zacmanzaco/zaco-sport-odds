/* ============================================================================
 * ZACO SPORT ODDS — Serveur de développement (Node.js, zéro dépendance)
 * ----------------------------------------------------------------------------
 *  • Sert le contenu statique du dossier /public
 *  • Expose /api/proxy?url=… : repli serveur lorsque le navigateur ne peut pas
 *    joindre directement les API (CORS ou réseau restreint)
 *  • Expose /api/health
 *
 * Lancement :  npm start        (http://localhost:5173)
 * ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';

/* Hôtes autorisés pour le proxy (évite tout usage détourné). */
const ALLOWED_HOSTS = [
  'api.openligadb.de',
  'www.thesportsdb.com',
  'thesportsdb.com'
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(body);
}

function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

/* ------------------------------- Proxy --------------------------------- */
async function handleProxy(req, res, url) {
  const target = url.searchParams.get('url');
  if (!target) return json(res, 400, { error: 'Paramètre « url » manquant.' });

  let parsed;
  try { parsed = new URL(target); }
  catch { return json(res, 400, { error: 'URL invalide.' }); }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return json(res, 403, { error: `Hôte non autorisé : ${parsed.hostname}` });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return json(res, 400, { error: 'Protocole non supporté.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ZacoSportOdds/1.0' }
    });
    const text = await upstream.text();
    clearTimeout(timer);
    send(res, upstream.status, text, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    });
  } catch (err) {
    clearTimeout(timer);
    json(res, 502, {
      error: 'Impossible de joindre la source distante.',
      detail: String(err && err.message || err),
      hint: 'Le serveur qui héberge cette page n\'a peut-être pas d\'accès Internet. ' +
            'Le navigateur tente d\'abord une requête directe (CORS) ; le snapshot embarqué reste disponible.'
    });
  }
}

/* --------------------------- Fichiers statiques ------------------------- */
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC, rel));
  // protection contre la traversée de répertoire
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, 'Accès refusé');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Repli SPA : toute route inconnue renvoie index.html
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, buf) => {
        if (e2) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
        send(res, 200, buf, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      });
    }
    fs.readFile(filePath, (e3, buf) => {
      if (e3) return send(res, 500, 'Erreur de lecture');
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, buf, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      });
    });
  });
}

/* ------------------------------ Routeur -------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'zaco-sport-odds', time: new Date().toISOString() });
  }
  if (url.pathname === '/api/proxy') {
    return handleProxy(req, res, url);
  }
  if (url.pathname.startsWith('/api/')) {
    return json(res, 404, { error: 'Route inconnue.' });
  }

  return serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`⚽ ZACO Sport Odds — serveur prêt sur http://${HOST}:${PORT}`);
  console.log(`   Proxy API : /api/proxy?url=<url encodée>  (hôtes autorisés : ${ALLOWED_HOSTS.join(', ')})`);
});
