# Frontend architecture

React + strict TypeScript + Vite, with two HTML entry points. `/index.html`, `/projects.html`, section anchors, the runtime `/config.js` API setting, and the existing local-first chat contract remain supported. Node 24 is used for development, tests, CI, and image builds.

`src/app` mounts each page and controls app-shell caching. `src/pages` composes the page. `src/features` owns portfolio, algorithms, demos, and chat. `src/shared` contains the API adapter, shared UI, and theme/layout styles. Components render state; event handlers request changes; effects own and clean up external resources. Domain algorithms, database projection, and sync do not depend on React.

The project gallery uses one ProjectCard with a shared action/status footer. All cards reserve the same action and status rows, including static cards. Controls wrap at narrow widths rather than overflowing or truncating. Theme tokens and focus/hover states are shared. CSS is normalized into readable base/demo styles; descending-specificity checks are disabled for the intentional responsive/component overrides, while all other standard CSS checks remain enabled.

Chat UI is split into room selection, account panes, and a session lifecycle hook. The session opens a per-room/account worker store before synchronizing. Typed commands commit to SQLite/outbox before reporting success. Snapshots commit locally before delivery receipts. SQL/projection and sync ownership remain feature services, separate from the React views. StrictMode remounts, unmounts, and page lifecycle events release resources. A back/forward cached page reloads its locally persisted state after resources close.

The browser always uses SQLite WASM/OPFS. The Node SQLite adapter is test-only. Room recovery/index keys, OPFS filenames, schema, Web Lock/BroadcastChannel names, and pending wire payloads are unchanged. Native workers load the pinned upstream SQLite loader/WASM/proxy files at stable `/vendor/sqlite/` URLs. Upstream files and license notices are copied verbatim; do not format them.

Vite serves the HTTP/WebSocket proxy in development and preview. COOP/COEP/CORP headers are mandatory for the OPFS worker and are configured in Vite and Nginx. Vite bundles the application worker and emits its assets into `dist`. The postbuild shell script caches built static files only, including worker/SQLite assets; APIs and credentials are excluded. Development removes only this app’s old service-worker registrations/cache namespace, never OPFS or localStorage. Use production preview for offline reload tests.

`dist` is generated and ignored. Edit source/root HTML/public assets, then build. React Testing Library/Vitest exercise real components; file-backed SQLite tests cover durability and projection; opt-in integration tests use real WebSockets through the proxy. Required command: `npm run check`. Type checking is separate from Vite transpilation. ESLint uses TypeScript-aware and React Hooks rules; Stylelint and Prettier check owned source, excluding vendor/build output.

Sources: [React component design](https://react.dev/learn/thinking-in-react), [React external synchronization](https://react.dev/learn/synchronizing-with-effects), [Vite multi-page builds](https://vite.dev/guide/build.html#multi-page-app), [SQLite WASM/Vite guidance](https://github.com/sqlite/sqlite-wasm#usage-with-vite).
