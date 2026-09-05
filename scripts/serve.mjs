#!/usr/bin/env node
/** Minimal static server for public/ — local preview only, no dependencies. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC } from './lib/manifest.mjs';

const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function createServer() {
  return http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(PUBLIC, url);
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    // Never serve outside the publish directory.
    if (!path.resolve(file).startsWith(path.resolve(PUBLIC))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
}

if (import.meta.filename === process.argv[1]) {
  createServer().listen(PORT, () => console.log(`→ http://localhost:${PORT}`));
}
