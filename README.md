# Oka Aryanata — Portfolio frontend

Static portfolio and six interactive projects: maze pathfinding, N-Queens, booking conflicts, Sudoku, Cat GIFs, and a live two-client IM chat demo. The Go backend is a separate sibling repository, `../oka-portfolio-api`.

## Run locally

Requires Node.js 22+ and Go 1.25+.

Terminal 1:

```sh
cd ../oka-portfolio-api
go run ./cmd/api
```

Terminal 2, from this repository:

```sh
npm run dev
```

Open http://127.0.0.1:4173/projects.html. Both demo accounts automatically sign in to the same isolated chat room using independent sessions. API calls and WebSocket upgrades pass through the Node development server to `http://127.0.0.1:8081`.

If 4173 is occupied, stop the old preview or use `PORT=4174 npm run dev`. Both default origins are allowed by the backend. `API_PROXY_TARGET` changes the local API target. The dev proxy expects an HTTP backend; use the API-base setting below for HTTPS services.

The frontend has no runtime npm dependencies and no build step. Test dependencies are installed with `npm ci`.

## Projects

- **Maze:** editable endpoints/walls, BFS/A* comparison, cancel/reset.
- **N-Queens:** sizes 4–8 with a stable chessboard, animated backtracking, cancellation, and reduced-motion support.
- **Booking:** a clearly labeled browser simulation, not a real reservation service.
- **Sudoku:** editable clues, sample/clear/reset, local validation, Go API solving, keyboard navigation, and visible errors.
- **Cat GIFs:** load/another/stop controls using CATAAS through Go. No autoplay; animation and requests stop when leaving the viewer or hiding the page.
- **IM Chat:** send, replies, copy, private stars, shared pins, delete-for-me, sender-only edit/revoke, delivery/read receipts, typing, and reconnect with duplicate prevention.

The homepage still has two cards per desktop carousel view and one on mobile. All six full demos are linked from the project-page sticky header. The homepage Sudoku sample shares the full solver's API module.

## Chat demo behavior

Demo A and Demo B are pre-registered demo identities, not real user accounts. The API creates a room unique to this browser and issues separate room/account sessions. Its recovery credential stays in browser local storage; account session tokens stay in memory. Another visitor cannot access the conversation without that room capability. Use only example messages.

History survives refreshes and backend restarts and expires after 24 hours without authenticated activity. Typing and heartbeats do not extend it. New demo switches both panes to a fresh room. Storage-disabled browsers can use the demo but cannot recover it after a refresh.

Both panes use real WebSockets. The backend commits mutations before publishing viewer-specific snapshots. Reconnection restores state and retries pending sends with the original idempotency key. Received messages are marked delivered; read receipts require the receiving pane to be visible with its all-messages view at the bottom. On mobile, panes stack and the offscreen pane does not automatically mark messages read.

Stars and delete-for-me are account-specific. Pins are shared. Revoking clears the text for both and removes it from pins/stars/reply previews. Editing and revoking are sender-only. Chats are text-only; uploads, groups, and calls are outside this portfolio demo.

## Separate hosting and containers

Set `dist/config.js` to an absolute API base ending in `/api/v1` when hosting frontend and API on different origins. Add the exact frontend origin to backend `CORS_ORIGINS`, including its scheme and port. WebSockets automatically use `ws:` or `wss:` matching the configured API. Never put secrets in frontend configuration.

With both sibling repositories present:

```sh
docker compose up --build
```

Frontend: http://127.0.0.1:4173. API: http://127.0.0.1:8081/healthz. Nginx proxies HTTP and WebSocket requests to the backend container. Compose builds `../oka-portfolio-api` and persists SQLite in the `chat-data` named volume. `docker compose down` preserves that volume; `down -v` removes demo history.

## Checks

```sh
npm ci
npm test
```

With both services running, exercise the actual frontend controllers and WebSocket proxy:

```sh
API_SMOKE_URL=http://127.0.0.1:4173 node --test tests/live-chat.test.mjs
```

This runs the DOM controllers against real sockets and SQLite; it does not replace visual browser QA.

Backend checks, from its own repository:

```sh
go test -race ./...
go vet ./...
```

Frontend tests cover algorithms, 8-Queens/reset behavior, API error paths, chat state/retry behavior, and DOM-level controllers. Backend tests include two real WebSocket clients, permissions, deduplication, SQLite persistence/expiry, and the existing Sudoku/cat checks. See the backend README and `docs/chat-protocol.md` for the network contract and resource limits.

## Layout

- `dist/`: deployable HTML/CSS, JavaScript modules, CV, and visual assets.
- `scripts/dev.mjs`: local static server with HTTP/WebSocket proxy support.
- `deploy/nginx.conf`, `Dockerfile`, `compose.yaml`: container setup.
- `tests/`: algorithm and UI regression tests.

No backend code or database lives in this repository. The original `../sudoku-solver` project is unchanged. The chat demo is newly written and does not copy company source.

## Portfolio content

Review employment dates and certification names before publication. The recovered CV download may be older than the training section; replace `dist/Oka_Aryanata_CV.pdf` with your latest version. Original external project links may need updating. No remote or hosting deployment is configured here.
