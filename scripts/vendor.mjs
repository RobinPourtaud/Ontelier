import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'node_modules/rdf-reasoner-konclude';
await mkdir('public/vendor/konclude', { recursive: true });
await mkdir('public/licenses', { recursive: true });
const hashes = {};
for (const file of ['worker.js', 'konclude.mjs', 'konclude.wasm']) {
  await copyFile(`${root}/dist/${file}`, `public/vendor/konclude/${file}`);
  hashes[file] = createHash('sha256').update(await readFile(`${root}/dist/${file}`)).digest('hex');
}
for (const file of ['LICENSE', 'NOTICE']) await copyFile(`${root}/${file}`, `public/licenses/konclude-${file}.txt`);
await writeFile('public/vendor/konclude/manifest.json', JSON.stringify({ version: JSON.parse(await readFile(`${root}/package.json`)).version, hashes }, null, 2));
