/// <reference lib="webworker" />
import { Repository } from './repository';
import type { Database } from './repository';
import type { Actor, StoreMethods } from '../types';
type DB = {
  exec: (options: {
    sql: string;
    bind?: unknown[];
    rowMode?: string;
    returnValue?: string;
  }) => Record<string, unknown>[];
  close: () => void;
};
type SQLiteModule = { oo1: { OpfsDb?: new (path: string) => DB } };
type Loader = (options: { locateFile: (file: string) => string }) => Promise<SQLiteModule>;
type Request = {
  [K in keyof StoreMethods]: { method: K; args: StoreMethods[K] };
}[keyof StoreMethods];
let repository: Repository | undefined,
  db: DB | undefined,
  lockName = '';
let queue = Promise.resolve();
const scope = self as unknown as DedicatedWorkerGlobalScope;
async function execute(
  request: Request | { method: 'init'; args: [string, Actor] } | { method: 'close'; args: [] },
) {
  if (request.method === 'init') {
    const [room, actor] = request.args;
    if (!/^[a-f0-9]{64}$/.test(room) || !['a', 'b'].includes(actor))
      throw new Error('Invalid local account identity.');
    if (!scope.crossOriginIsolated || !navigator.storage.getDirectory || !navigator.locks)
      throw new Error('Persistent SQLite requires a supported browser and cross-origin isolation.');
    lockName = `oka-local-db:${room}:${actor}`;
    return navigator.locks.request(lockName, async () => {
      const vendorURL = new URL('/vendor/sqlite/index.mjs', scope.location.origin).href;
      const module = (await import(/* @vite-ignore */ vendorURL)) as { default: Loader };
      const sqlite = await module.default({
        locateFile: (file) => new URL('/vendor/sqlite/' + file, scope.location.origin).href,
      });
      if (!sqlite.oo1.OpfsDb)
        throw new Error('Persistent SQLite OPFS is unavailable in this browser.');
      const opened = new sqlite.oo1.OpfsDb(`/oka-chat-${room}-${actor}.sqlite3`);
      db = opened;
      const adapter: Database = {
        exec: (sql, bind = []) => opened.exec({ sql, bind }),
        query: (sql, bind = []) =>
          opened.exec({ sql, bind, rowMode: 'object', returnValue: 'resultRows' }),
      };
      repository = new Repository(adapter, room, actor);
      return repository.read();
    });
  }
  const repo = repository;
  if (!repo) throw new Error('Local SQLite has not opened.');
  return navigator.locks.request(lockName, () => {
    switch (request.method) {
      case 'close':
        db?.close();
        return null;
      case 'read':
        return repo.read();
      case 'enqueue':
        return repo.enqueue(...request.args);
      case 'snapshot':
        return repo.snapshot(...request.args);
      case 'acknowledge':
        return repo.acknowledge(...request.args);
      case 'reject':
        return repo.reject(...request.args);
      case 'prepare':
        return repo.prepare();
      case 'update':
        return repo.update(...request.args);
      case 'discard':
        return repo.discard(...request.args);
      case 'retry':
        return repo.retry(...request.args);
      case 'clear':
        return repo.clear();
    }
  });
}
scope.onmessage = ({ data }: { data: Request & { id: number } }) => {
  queue = queue.then(async () => {
    try {
      const value = await execute(data);
      scope.postMessage({ id: data.id, value });
    } catch (error) {
      scope.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : 'Local storage failed.',
      });
    }
  });
};
