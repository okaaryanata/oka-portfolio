# Portfolio engineering agreements

This repository is the React + TypeScript frontend. The sibling backend is `../svaha-uni-api`.

- Start from this repository root. Read the README and relevant architecture notes before a broad change; inspect only the feature needed for a small fix.
- Keep page composition, feature UI/hooks, domain logic, persistence, and network adapters separate. Prefer small explicit APIs and composition. Add abstractions only for an actual responsibility or replacement boundary.
- Keep TypeScript strict. Validate external inputs; use `unknown` and narrow it instead of introducing `any` or hiding errors with blanket lint exclusions.
- Preserve API/WebSocket contracts, room/account isolation, SQLite filenames and schema, localStorage keys, durable operation IDs, and commit-before-send/receipt ordering. Never replace browser SQLite with an in-memory fallback.
- React effects must release subscriptions, timers, requests, sockets, and workers, including StrictMode remounts. Keep algorithms and persistence independent of React.
- Edit `src`, root HTML entrypoints, and `public` assets. `dist` is generated. Do not reformat or modify upstream files under `public/vendor/sqlite`; use the pinned vendor refresh script.
- Check accessible names, keyboard navigation, light/dark themes, narrow layouts, and reduced motion for UI changes.
- Add meaningful regression tests for changed behavior. Run focused tests while iterating; before completion run `npm run check`. Report any unavailable browser/container checks honestly.
- Make incremental conventional commits with the existing Git identity. Do not rewrite user changes, invent authors, or push without instruction.
- Keep context and output focused. Reuse verified findings, batch independent reads, and avoid repeated full suites unless changes or failures justify them. Use one agent unless delegation is explicitly requested. See `docs/ai-workflow.md` for handoff and credit guidance.
