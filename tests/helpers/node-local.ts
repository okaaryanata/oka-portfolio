// Real file-backed SQLite for tests only. Browsers always use the OPFS worker.
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../../src/features/chat/persistence/repository';
import type { Actor, LocalStore, StoreMethods, StoreResult } from '../../src/features/chat/types';
export interface TestStore extends LocalStore {
  repository: Repository;
  actor: Actor;
  room: string;
  path: string;
}
export function localStores() {
  const directory = mkdtempSync(join(tmpdir(), 'oka-react-tests-')),
    listeners = new Map<string, Set<() => void>>(),
    opened: TestStore[] = [];
  const open = async (room: string, actor: Actor): Promise<TestStore> => {
    const path = join(directory, `${room}-${actor}.db`),
      key = room + ':' + actor,
      db = new DatabaseSync(path),
      repository = new Repository(
        {
          exec(sql, bind = []) {
            if (bind.length) return db.prepare(sql).run(...(bind as SQLInputValue[]));
            db.exec(sql);
          },
          query(sql, bind = []) {
            return db.prepare(sql).all(...(bind as SQLInputValue[]));
          },
        },
        room,
        actor,
      );
    let closed = false;
    const own = new Set<() => void>();
    if (!listeners.has(key)) listeners.set(key, new Set());
    const store: TestStore = {
      room,
      actor,
      path,
      repository,
      call<K extends keyof StoreMethods>(
        method: K,
        ...args: StoreMethods[K]
      ): Promise<StoreResult<K>> {
        if (closed) return Promise.reject(new Error('closed'));
        const handler = repository[method] as (...params: unknown[]) => unknown;
        try {
          const result = handler.apply(repository, args) as StoreResult<K>;
          if (!['read', 'prepare'].includes(method))
            for (const listener of listeners.get(key)!) queueMicrotask(listener);
          return Promise.resolve(result);
        } catch (error) {
          return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      subscribe(listener) {
        own.add(listener);
        listeners.get(key)!.add(listener);
        return () => {
          own.delete(listener);
          listeners.get(key)!.delete(listener);
        };
      },
      close() {
        if (!closed) {
          closed = true;
          for (const listener of own) listeners.get(key)!.delete(listener);
          db.close();
        }
        return Promise.resolve();
      },
    };
    opened.push(store);
    await Promise.resolve();
    return store;
  };
  return {
    open,
    opened,
    directory,
    async cleanup() {
      await Promise.all(opened.map((s) => s.close()));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
export function lockManager(): LockManager {
  type Item = {
    callback: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
  };
  const queues = new Map<string, { running: boolean; items: Item[] }>();
  const drain = (name: string) => {
    const q = queues.get(name);
    if (!q || q.running || !q.items.length) return;
    const item = q.items.shift()!;
    if (item.signal?.aborted) {
      item.reject(new DOMException('aborted', 'AbortError'));
      drain(name);
      return;
    }
    q.running = true;
    queueMicrotask(() => {
      void item
        .callback()
        .then(item.resolve, item.reject)
        .finally(() => {
          q.running = false;
          drain(name);
        });
    });
  };
  return {
    request(name: string, options: { signal?: AbortSignal }, callback: () => Promise<unknown>) {
      return new Promise((resolve, reject) => {
        if (!queues.has(name)) queues.set(name, { running: false, items: [] });
        const item: Item = { resolve, reject, callback, signal: options.signal };
        queues.get(name)!.items.push(item);
        options.signal?.addEventListener(
          'abort',
          () => {
            const q = queues.get(name)!,
              index = q.items.indexOf(item);
            if (index >= 0) {
              q.items.splice(index, 1);
              reject(new DOMException('aborted', 'AbortError'));
            }
          },
          { once: true },
        );
        drain(name);
      });
    },
  } as unknown as LockManager;
}
