import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SRC = path.join(ROOT, 'src');
export const PUBLIC = path.join(ROOT, 'public');
export const ASSETS = path.join(PUBLIC, 'assets');
export const MANIFEST = path.join(ASSETS, 'manifest.json');

/** Short content hash, used to make every /assets/* URL safely immutable. */
export const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);

export function writeHashed(name, ext, buf) {
  fs.mkdirSync(ASSETS, { recursive: true });
  const file = `${name}.${hash(buf)}.${ext}`;
  fs.writeFileSync(path.join(ASSETS, file), buf);
  return { file, url: `/assets/${file}`, bytes: buf.length };
}

export const readManifest = () =>
  fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

export function mergeManifest(patch) {
  const next = { ...readManifest(), ...patch };
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(next, null, 2) + '\n');
  return next;
}

/** Delete generated files that no longer appear in the manifest. */
export function prune(manifest) {
  if (!fs.existsSync(ASSETS)) return [];
  const keep = new Set(['manifest.json']);
  const walk = (v) => {
    if (typeof v === 'string' && v.startsWith('/assets/')) keep.add(v.slice('/assets/'.length));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(manifest);
  const removed = [];
  for (const f of fs.readdirSync(ASSETS)) {
    if (!keep.has(f)) { fs.unlinkSync(path.join(ASSETS, f)); removed.push(f); }
  }
  return removed;
}

export const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
