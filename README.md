# Oka Aryanata — Portfolio frontend

React + TypeScript + Vite portfolio with six interactive demos. Backend: sibling `../svaha-uni-api`.

## Run

Requires Node 24. Start the backend with `go run ./cmd/api` from its repository, then:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173/ or http://127.0.0.1:4173/projects.html. API and WebSocket traffic proxies to port 8081. `PORT=4174 npm run dev -- --bypass-lock` starts a second instance on the alternate allowed origin; `API_PROXY_TARGET` changes the local backend target. Use a consistent origin: browser databases on different ports are independent.

For production/offline testing, stop the dev server on that port and run:

```sh
npm run build
npm run preview
```

Offline caching is production-only. A previously initialized demo can reopen with the services unavailable. Development disables this app’s shell cache so edits do not serve stale modules; chat SQLite data is preserved.

## Source and checks

- `src/app`, `src/pages`: two page entrypoints and composition.
- `src/features`: React UI, algorithms, typed SQLite persistence and synchronization.
- `src/shared`: API, layout/theme/menu primitives and shared styles.
- `public`: CV/images/runtime config and verbatim pinned SQLite assets.
- `dist`: generated output; do not edit or commit it.
- `tests`: Vitest/React Testing Library, real file SQLite, and opt-in live proxy checks.

```sh
npm run check
API_SMOKE_URL=http://127.0.0.1:4173 npx vitest run tests/live-chat.test.tsx
```

The check command runs ESLint, Stylelint, formatting, strict type checking, tests, and a production build. `npm run format` formats owned source. `npm run vendor:sqlite` refreshes pinned vendor assets from the installed package. See [architecture](docs/architecture.md), [AI workflow and credit guidance](docs/ai-workflow.md), and [agent rules](AGENTS.md).

## Chat demo behavior

Demo A and Demo B are pre-registered demo identities, not real user accounts. The API creates a room unique to this browser and issues separate room/account sessions. Its recovery credential and saved-room index stay in browser local storage; account session tokens stay in memory. Messages, drafts, read state, and pending operations are stored in separate room/account SQLite databases in the browser’s OPFS, not in localStorage or the frontend repository. Another visitor cannot access the conversation without that room capability. Use only example messages.

Backend rooms expire after 24 hours without authenticated activity. Local history and queued work remain on this browser until explicitly cleared; browser storage clearing/eviction can also remove them. Typing and heartbeats do not extend it. New demo switches both panes to new account databases and keeps the old room in Saved demos. Expired server rooms become local archives; queued work is retained and never automatically submitted into a fresh room. Clear local data explicitly removes the selected local copy and queued work for both accounts. Browsers without persistent OPFS/worker support show an error; there is no memory-only fallback.

Each pane starts on its conversation list and stays connected there. The row shows the other account’s name, latest visible message, timestamp, and a red unread dot with an accessible unread count. Opening the row enters conversation detail; The back arrow returns to the list without going offline. Detail shows the other account’s online/offline presence. If this client is disconnected, peer presence is Unknown rather than stale Online/Offline.

The preview updates when the latest message is edited or revoked. Revocation shows Message revoked; delete-for-me falls back to that account’s previous visible message, or No messages yet. Edits do not create new unread activity or reorder history. Revoked/hidden messages do not contribute to unread counts; pins and stars do not replace the preview.

Go offline intentionally disconnects one account and pauses automatic reconnect. Go online restores it and synchronizes current history. A sender can successfully send while its peer is offline: Sent means saved by the server, Delivered follows receiver acknowledgment, and Read follows eligible viewing. While on the list, receiving and acknowledging delivery never clears the unread dot. Manual offline preserves the current view, and persists drafts, pending operations, and connection intent in local SQLite. Go offline / Go online affects that account across all tabs on this origin. Messages and supported actions can be queued offline; a committed message appears as Queued until synchronization resumes.

Both panes use real WebSockets. The UI reads local SQLite only. A local transaction commits each user action and its outbox operation before the UI reports success or the sync engine transmits it. The backend commits both a mutation and its replayable outcome before publishing snapshots and acknowledging it. Incoming snapshots commit to recipient-local SQLite before delivery acknowledgment is queued. Reconnection merges confirmed state with the durable local outbox, preserving unsent work and retrying exact operation payloads with their original idempotency keys. Unsent dependencies, such as replying to a queued message, resolve after the original send receives its server ID. Edits carry expected message versions; conflicts retain attempted text for explicit Retry with current version, Copy, or Discard instead of overwriting a newer server version. A single sync owner per room/account is elected with Web Locks; BroadcastChannel notifies other tabs, while database operations run in dedicated workers and serialize per account. Closing the owner tab transfers synchronization without duplicate sends.

Received messages are marked delivered; read receipts require conversation detail to be open, the latest messages visible in the all-messages view at the bottom, and the document active. On mobile, panes stack and the offscreen pane does not automatically mark messages read.

Stars and delete-for-me are account-specific. Pins are shared. Revoking clears the text for both and removes it from pins/stars/reply previews. Editing and revoking are sender-only. Chats are text-only; uploads, groups, and calls are outside this portfolio demo.

## Containers and deployment

`docker compose up --build` builds this frontend and `../svaha-uni-api`. Nginx exposes the frontend on port 4173 and proxies to the API on 8081. The existing `chat-data` named volume is retained; avoid removing volumes when preserving chat history.

The frontend image builds source with Node 24 before copying `dist` into Nginx. Set `public/config.js` before building (or replace `/config.js` in the deployed static directory) to use a different absolute API base ending in `/api/v1`. Add its exact frontend origin to backend CORS_ORIGINS. Never place secrets in frontend configuration.

Serve over HTTPS or localhost with COOP same-origin, COEP require-corp, CORP same-origin, and application/wasm MIME. Supplied Vite/Nginx configurations provide these. New generated files must be included in the static-only service-worker manifest; API responses and credentials must never be cached.

The existing database schemas and network contracts are unchanged. The original `loan`, `user-svc`, and `sudoku-solver` repositories are references only. No Git remote or public deployment is configured by this change.
