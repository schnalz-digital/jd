// Cache-busting version stamp
// Derives a short hash from the content of the static assets and
// stamps it as ?v=... on the asset URLs inside index.html.
// Idempotent: unchanged assets -> unchanged index.html -> no git churn.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const assets = ['css/styles.css', 'js/app.js', 'js/config.js'];

const hash = createHash('sha256');
for (const file of assets) {
  hash.update(readFileSync(path.join(root, file)));
}
const version = hash.digest('hex').slice(0, 8);

const indexPath = path.join(root, 'index.html');
const html = readFileSync(indexPath, 'utf8');

const next = html
  .replace(/(href="css\/styles\.css)(\?[^"]*)?(")/, `$1?v=${version}$3`)
  .replace(/(src="js\/config\.js)(\?[^"]*)?(")/, `$1?v=${version}$3`)
  .replace(/(src="js\/app\.js)(\?[^"]*)?(")/, `$1?v=${version}$3`);

if (next !== html) {
  writeFileSync(indexPath, next);
  console.log(`version: ${version} — index.html updated`);
} else {
  console.log(`version: ${version} — unchanged`);
}