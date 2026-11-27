import type { Actor, LocalStore, StoreMethods, StoreResult } from '../types';
type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  method: string;
};
export class BrowserStore implements LocalStore {
  private worker: Worker;
  private channel: BroadcastChannel;
  private requests = new Map<number, Pending>();
  private listeners = new Set<() => void>();
  private id = 0;
  private closed = false;
  private failed = false;
  constructor(room: string, actor: Actor) {
    this.worker = new Worker(new URL('./sqlite-worker.ts', import.meta.url), { type: 'module' });
    this.channel = new BroadcastChannel(`oka-local-db:${room}:${actor}`);
    this.worker.onmessage = ({
      data,
    }: {
      data: { id: number; value: unknown; error?: string };
    }) => {
      const request = this.requests.get(data.id);
      if (!request) return;
      this.requests.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.value);
    };
    this.worker.onerror = () => {
      this.failed = true;
      for (const request of this.requests.values())
        request.reject(new Error('Local SQLite worker failed. Your message was not sent.'));
      this.requests.clear();
    };
    this.channel.onmessage = () => this.notify();
  }
  get hasUncommittedWrites() {
    return [...this.requests.values()].some(
      (request) => !['read', 'init', 'close'].includes(request.method),
    );
  }
  private async rpc(method: string, args: unknown[]): Promise<unknown> {
    if (this.closed && method !== 'close') throw new Error('Local database closed.');
    if (this.failed) throw new Error('Local SQLite is unavailable. Your message was not sent.');
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.requests.set(id, { resolve, reject, method });
      this.worker.postMessage({ id, method, args });
    });
  }
  async open(room: string, actor: Actor) {
    await this.rpc('init', [room, actor]);
  }
  async call<K extends keyof StoreMethods>(
    method: K,
    ...args: StoreMethods[K]
  ): Promise<StoreResult<K>> {
    const value = await this.rpc(method, args);
    if (!['read', 'prepare'].includes(method)) {
      this.channel.postMessage('changed');
      this.notify();
    }
    return value as StoreResult<K>;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private notify() {
    for (const listener of this.listeners) listener();
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (!this.failed) await this.rpc('close', []);
    } catch {
      // Initialization may have failed before a database was opened.
    } finally {
      this.worker.terminate();
      this.channel.close();
      for (const request of this.requests.values())
        request.reject(new Error('Local database closed.'));
      this.requests.clear();
    }
  }
}
export async function openBrowserStore(room: string, actor: Actor): Promise<LocalStore> {
  const store = new BrowserStore(room, actor);
  try {
    await store.open(room, actor);
    return store;
  } catch (error) {
    await store.close();
    throw error;
  }
}
