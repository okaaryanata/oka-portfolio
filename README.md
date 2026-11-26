# Oka Aryanata — Portfolio

A dependency-free static portfolio with light/dark themes, experience, training, a deployment case study, a CV download, and five personal projects.

## Run locally

Requires Python 3. No installation or build step is needed.

```sh
npm run dev
```

Open http://127.0.0.1:4173. Alternatively, run `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`.

## Check

Requires Node.js 18 or newer.

```sh
npm test
```

## Project layout

- `dist/index.html`, `style.css`, `app.js`: portfolio and Sudoku/cat interactions.
- `dist/projects.html`, `projects.css`, `projects.mjs`: pathfinding, N-Queens, and booking demos.
- `dist/algorithms.mjs`: dependency-free algorithms, covered by Node tests.
- `dist/theme.js`: shared theme preference.
- `dist/Oka_Aryanata_CV.pdf`, `cat.gif`, `cat-still.png`: recovered original assets.

## Content to review before publishing

The original portfolio source was recovered from the Site linked in the shared ChatGPT conversation. Experience and training wording are preserved. The shared conversation says the downloadable CV was from an earlier version; replace `dist/Oka_Aryanata_CV.pdf` with the latest CV before sharing with recruiters. Confirm employment dates, certification names, and the original project links before launch.

The booking demo is a browser-only simulation, not a real booking system or a demonstration of database concurrency. It does not send requests or store personal data.

## Hosting

Serve `dist/` from any static host, Caddy, Nginx, or a container. The site has no server/API dependencies. This repository is local; it does not change the original hosted ChatGPT Site. No remote is configured.
