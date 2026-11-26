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

The frontend ships pinned SQLite WebAssembly assets under `dist/vendor/sqlite`, so runtime package installation is not needed. `npm ci` installs test and asset-refresh dependencies. `npm run vendor:sqlite` reproduces the vendor assets; `npm run build:shell` regenerates the offline cache manifest and runs automatically before the dev server starts.

## Projects

- **Maze:** editable endpoints/walls, BFS/A* comparison, cancel/reset.
- **N-Queens:** sizes 4–8 with a stable chessboard, animated backtracking, cancellation, and reduced-motion support.
- **Booking:** a clearly labeled browser simulation, not a real reservation service.
- **Sudoku:** editable clues, sample/clear/reset, local validation, Go API solving, keyboard navigation, and visible errors.
- **Cat GIFs:** load/another/stop controls using CATAAS through Go. No autoplay; animation and requests stop when leaving the viewer or hiding the page.
- **IM Chat:** conversation lists with unread red dots, accurate message previews, peer presence, per-client offline controls, send/replies/copy, private stars, shared pins, delete-for-me, sender-only edit/revoke, receipts, typing, and reconnect with duplicate prevention.

The homepage still has two cards per desktop carousel view and one on mobile. All six full demos are linked from the project-page sticky header. The homepage Sudoku sample shares the full solver's API module.

## Chat demo behavior

Demo A and Demo B are pre-registered demo identities, not real user accounts. The API creates a room unique to this browser and issues separate room/account sessions. Its recovery credential and saved-room index stay in browser local storage; account session tokens stay in memory. Messages, drafts, read state, and pending operations are stored in separate room/account SQLite databases in the browser’s OPFS, not in localStorage or the frontend repository. Another visitor cannot access the conversation without that room capability. Use only example messages.

Backend rooms expire after 24 hours without authenticated activity. Local history and queued work remain on this browser until explicitly cleared; browser storage clearing/eviction can also remove them. Typing and heartbeats do not extend it. New demo switches both panes to new account databases and keeps the old room in Saved demos. Expired server rooms become local archives; queued work is retained and never automatically submitted into a fresh room. Clear local data explicitly removes the selected local copy and queued work for both accounts. Browsers without persistent OPFS/worker support show an error; there is no memory-only fallback.

Each pane starts on its conversation list and stays connected there. The row shows the other account’s name, latest visible message, timestamp, and a red unread dot with an accessible unread count. Opening the row enters conversation detail; Conversations returns to the list without going offline. Detail shows the other account’s online/offline presence. If this client is disconnected, peer presence is Unknown rather than stale Online/Offline.

The preview updates when the latest message is edited or revoked. Revocation shows Message revoked; delete-for-me falls back to that account’s previous visible message, or No messages yet. Edits do not create new unread activity or reorder history. Revoked/hidden messages do not contribute to unread counts; pins and stars do not replace the preview.

Go offline intentionally disconnects one account and pauses automatic reconnect. Go online restores it and synchronizes current history. A sender can successfully send while its peer is offline: Sent means saved by the server, Delivered follows receiver acknowledgment, and Read follows eligible viewing. While on the list, receiving and acknowledging delivery never clears the unread dot. Manual offline preserves the current view, and persists drafts, pending operations, and connection intent in local SQLite. Go offline / Go online affects that account across all tabs on this origin. Messages and supported actions can be queued offline; a committed message appears as Queued until synchronization resumes.

Both panes use real WebSockets. The UI reads local SQLite only. A local transaction commits each user action and its outbox operation before the UI reports success or the sync engine transmits it. The backend commits both a mutation and its replayable outcome before publishing snapshots and acknowledging it. Incoming snapshots commit to recipient-local SQLite before delivery acknowledgment is queued. Reconnection merges confirmed state with the durable local outbox, preserving unsent work and retrying exact operation payloads with their original idempotency keys. Unsent dependencies, such as replying to a queued message, resolve after the original send receives its server ID. Edits carry expected message versions; conflicts retain attempted text for explicit Retry with current version, Copy, or Discard instead of overwriting a newer server version. A single sync owner per room/account is elected with Web Locks; BroadcastChannel notifies other tabs, while database operations run in dedicated workers and serialize per account. Closing the owner tab transfers synchronization without duplicate sends.

Received messages are marked delivered; read receipts require conversation detail to be open, the latest messages visible in the all-messages view at the bottom, and the document active. On mobile, panes stack and the offscreen pane does not automatically mark messages read.

Stars and delete-for-me are account-specific. Pins are shared. Revoking clears the text for both and removes it from pins/stars/reply previews. Editing and revoking are sender-only. Chats are text-only; uploads, groups, and calls are outside this portfolio demo.

## Separate hosting and containers

Set `dist/config.js` to an absolute API base ending in `/api/v1` when hosting frontend and API on different origins. Add the exact frontend origin to backend `CORS_ORIGINS`, including its scheme and port. WebSockets automatically use `ws:` or `wss:` matching the configured API. Never put secrets in frontend configuration. Serve the app over HTTPS or localhost with `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and an `application/wasm` MIME type. The supplied dev server and Nginx configuration provide these. Local databases are origin-specific: ports 4173 and 4174 have separate browser storage. Use a consistent URL. A service worker caches only static app/SQLite assets; API responses and credentials are never cached there.

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
- `dist/local/`: SQLite repository, worker adapter, durable outbox projections and sync ownership.
- `dist/sw.js`: generated static-only offline shell cache; a previously initialized demo can reopen with both services unavailable.
- `tests/`: algorithm, SQLite, synchronization and UI regression tests.

No backend code or database lives in this repository. The original `../sudoku-solver` project is unchanged. The chat demo is newly written and does not copy company source.

## Portfolio content

Review employment dates and certification names before publication. The recovered CV download may be older than the training section; replace `dist/Oka_Aryanata_CV.pdf` with your latest version. Original external project links may need updating. No remote or hosting deployment is configured here.

## Local-first flow and verification

```text
A local SQLite transaction (message + outbox)
  -> backend transaction (message + durable outcome)
  -> B local SQLite transaction (received state)
  -> B delivery acknowledgment
```

Queued means saved locally, Sending means prepared/in flight, Sent means persisted centrally, Delivered means persisted by the receiving client, and Read requires eligible viewing. Read and other message actions also persist locally before synchronization. Typing and presence remain transient and unknown offline.

`npm test` uses actual file-backed SQLite through Node’s test-only adapter, including reopen/crash boundaries, quota/commit failure, pending-action projection, conflict review, recipient commit-before-ack, and multi-tab owner handover. It never substitutes that adapter in a browser. Live integration tests inject independent client SQLite files while exercising the real Go server and WebSocket proxy.

Manual Chrome verification additionally covered real WASM/OPFS initialization for both accounts, offline send plus reload, full app reload with both preview services stopped, shared history in a second tab, sync-owner closure, and successful delivery after handover. The app warns before navigation while a local send/write is still uncommitted. Browser-managed storage is best effort; it is not a backup guarantee.
