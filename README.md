# Ontelier

Ontelier is a local-first ontology workshop that runs in your browser. Edit Turtle and RDF, explore classes and relationships, run OWL reasoning, validate with SHACL Core, and query with SPARQL. Projects are stored in your browser's IndexedDB and can be exported as Turtle files.

Created by [Robin Pourtaud](https://pourtaud.dev/). If you build on Ontelier, please link to his site in your project credits.

## Run locally

Requires Node.js `^22.12.0` or `>=24.0.0` and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The first install copies Konclude's WebAssembly files and license notices from `rdf-reasoner-konclude` into `public/`. Those generated files are ignored by Git. `npm run build` repeats this step, so a fresh checkout can build without committing binaries.

## Development

```sh
npm run typecheck
npm test
npm run build
```

Browser tests use Playwright Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Chromium is already installed at a custom path. The browser tests start their own Vite server on port 5178.

The app runs OWL reasoning in a browser worker using Konclude WebAssembly. The editor, graph, and validation logic live in `src/`; `src/core/` holds ontology operations; `src/workers/` holds worker entry points. Test fixtures are in `tests/fixtures/`.

## Deploy

`npm run build` produces the static site in `dist/`. The app needs the headers in `public/_headers` for cross-origin isolation and its content security policy. If your host does not support `_headers`, configure equivalent response headers there.

For Cloudflare Workers, authenticate Wrangler and run `npm run deploy` to use the generic `wrangler.jsonc`. To deploy to a custom route, create an ignored `wrangler.local.jsonc` with your own route settings and run `npm run deploy:local`. Keep account-specific IDs and credentials out of tracked files.

## Data and scope

Ontelier stores projects on the current device. Ontology data and logical computation stay in the browser; remote SPARQL `SERVICE` queries and remote shape imports are disabled. Export important projects as Turtle files, since clearing browser storage removes local projects.

The graph view limits large ontologies to 160 named entities and 40 expression nodes. SHACL validation supports Core constraints. Advanced nested OWL expressions can be edited in Turtle even when the visual editor does not expose them.

## Licenses

Ontelier's source is [MIT licensed](LICENSE). The bundled Konclude reasoner is licensed separately under LGPL-3.0-or-later. Its license, notice, corresponding source link, and build instructions are supplied by `rdf-reasoner-konclude` and copied into the built site under `/licenses/`. The Quicksand font is licensed under the [SIL Open Font License](public/fonts/OFL.txt).

Contributions and bug reports are welcome. Please run the relevant checks above and describe how you tested changes in your pull request.
