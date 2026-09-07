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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
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

    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const size = fs.statSync(file).size;
    const head = {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
    };

    // Safari will not play a video the server cannot serve in pieces: it opens
    // with a Range request and treats a plain 200 as an unsupported source.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : size - Number(range[2]);
      const end = range[1] && range[2] ? Number(range[2]) : size - 1;
      if (!(start >= 0 && end < size && start <= end)) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      res.writeHead(206, {
        ...head,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...head, 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
  });
}

if (import.meta.filename === process.argv[1]) {
  createServer().listen(PORT, () => console.log(`→ http://localhost:${PORT}`));
}
