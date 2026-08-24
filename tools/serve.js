/* Servidor estatico sem dependencias.  uso: node tools/serve.js [porta] */
const http = require('http');
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

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }
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
