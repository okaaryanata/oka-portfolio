import { copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/vendor/sqlite/', root), { recursive: true });
for (const name of ['index.mjs', 'sqlite3.wasm', 'sqlite3-opfs-async-proxy.js'])
  await copyFile(
    new URL('node_modules/@sqlite.org/sqlite-wasm/dist/' + name, root),
    new URL('public/vendor/sqlite/' + name, root),
  );
