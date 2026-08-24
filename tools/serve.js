/* Servidor estatico sem dependencias.  uso: node tools/serve.js [porta] */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..', 'www');
const PORT = Number(process.argv[2]) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* Proxy /fd/... -> api.football-data.org/v4/...
   A football-data.org so libera CORS para "http://localhost" (sem porta), o que barra
   o navegador em localhost:5173. Repassamos aqui. A chave vem no cabecalho do app e
   NAO fica guardada no servidor. */
function proxyFootballData(req, res) {
  const caminho = req.url.replace(/^\/fd/, '');
  const opcoes = {
    method: 'GET',
    headers: { 'X-Auth-Token': req.headers['x-auth-token'] || '' }
  };
  const r = https.request('https://api.football-data.org/v4' + caminho, opcoes, (up) => {
    res.writeHead(up.statusCode || 502, {
      'content-type': up.headers['content-type'] || 'application/json',
      'access-control-allow-origin': '*'
    });
    up.pipe(res);
  });
  r.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'proxy falhou: ' + e.message }));
  });
  r.end();
}

http.createServer((req, res) => {
  if (req.url.indexOf('/fd/') === 0) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'x-auth-token',
        'access-control-allow-methods': 'GET,OPTIONS'
      });
      res.end();
      return;
    }
    proxyFootballData(req, res);
    return;
  }

  let rel = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }
  // raiz, barra dupla ou qualquer pasta -> index.html
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  } catch (_) { /* nao existe: cai no 404 abaixo */ }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  const ips = [];
  Object.values(os.networkInterfaces()).forEach((list) =>
    (list || []).forEach((n) => { if (n.family === 'IPv4' && !n.internal) ips.push(n.address); }));
  console.log('\n  GREEN rodando:');
  console.log('  neste PC .......... http://localhost:' + PORT);
  ips.forEach((ip) => console.log('  no celular (wifi) . http://' + ip + ':' + PORT));
  console.log('\n  Ctrl+C para parar.\n');
});
