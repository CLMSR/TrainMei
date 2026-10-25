const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('PWA manifest references existing install icons and stays in app subpath', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), `missing ${icon.src}`);
});

test('PWA service worker exists, parses, avoids forced reload, and does not cache cross-origin API traffic', () => {
  const sw = read('sw.js');
  const executable = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(sw, /addEventListener\('install'/);
  assert.match(sw, /addEventListener\('activate'/);
  assert.match(sw, /addEventListener\('fetch'/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.doesNotMatch(executable, /skipWaiting\s*\(/);
  assert.doesNotMatch(executable, /clients\.claim\s*\(/);
  assert.doesNotMatch(executable, /location\.reload\s*\(/);
  assert.doesNotMatch(executable, /setInterval\s*\(/);
});

test('mobile viewport prevents pinch/double-tap zoom where browser policy permits', () => {
  const html = read('index.html');
  assert.match(html, /maximum-scale=1/);
  assert.match(html, /user-scalable=no/);
  assert.match(html, /viewport-fit=cover/);
});
