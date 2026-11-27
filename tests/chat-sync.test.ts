// @vitest-environment node
import { test, expect, vi } from 'vitest';
import { localStores, lockManager } from './helpers/node-local';
import { SyncEngine } from '../src/features/chat/sync/engine';
import { APIError } from '../src/shared/api';
import type { Message, ServerEvent } from '../src/features/chat/types';
import type { api } from '../src/shared/api';
const request = (() => Promise.resolve({ token: 'token' })) as typeof api;
export class FakeSocket {
  static sockets: FakeSocket[] = [];
  readyState = 0;
  handlers = new Map<string, ((event: unknown) => void)[]>();
  sent: Record<string, unknown>[] = [];
  constructor() {
    FakeSocket.sockets.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('open', {});
    });
  }
  addEventListener(name: string, fn: (event: unknown) => void) {
    const handlers = this.handlers.get(name) || [];
    handlers.push(fn);
    this.handlers.set(name, handlers);
  }
  emit(name: string, event: unknown) {
    for (const fn of this.handlers.get(name) || []) fn(event);
  }
  event(value: ServerEvent) {
    this.emit('message', { data: JSON.stringify(value) });
  }
  send(json: string) {
    const value = JSON.parse(json) as Record<string, unknown>;
    this.sent.push(value);
    if (value.type === 'auth')
      queueMicrotask(() => this.event({ type: 'snapshot', revision: 0, messages: [] }));
  }
  close() {
    this.readyState = 3;
    this.emit('close', { code: 1000 });
  }
}
const Socket = FakeSocket as unknown as typeof WebSocket;
const message: Message = {
  id: 'server-1',
  client_message_id: 'client-1',
  sender_id: 'a',
  text: 'hello',
  created_at: 1,
  version: 1,
  read: false,
  delivered: false,
  revoked: false,
  starred: false,
  pinned: false,
};
const until = async (check: () => boolean) => {
  await vi.waitFor(() => expect(check()).toBe(true), { timeout: 2500, interval: 5 });
};
function environment() {
  vi.stubGlobal('location', { href: 'http://127.0.0.1:4173/' });
  FakeSocket.sockets = [];
}
test('recipient commits its SQLite history before delivery acknowledgment', async (t) => {
  environment();
  const stores = localStores(),
    store = await stores.open('room', 'b'),
    observer = await stores.open('room', 'b');
  const original = store.call.bind(store);
  store.call = async (method, ...args) => {
    if (method === 'enqueue') expect((await observer.call('read')).messages[0].text).toBe('hello');
    return original(method, ...args);
  };
  const engine = new SyncEngine({ room_id: 'room', recovery_token: 'secret' }, 'b', store, {
    locks: lockManager(),
    Socket,
  });
  t.onTestFinished(async () => {
    await engine.close();
    await stores.cleanup();
  });
  await engine.receive({ type: 'snapshot', revision: 1, messages: [message] });
  expect(observer.repository.read().operations[0].payload.action).toBe('delivered');
});
test('one owner hands over and retries the exact durable operation after losing its acknowledgment', async (t) => {
  environment();
  const stores = localStores(),
    a = await stores.open('room', 'a'),
    b = await stores.open('room', 'a'),
    locks = lockManager(),
    room = { room_id: 'room', recovery_token: 'secret' };
  const first = new SyncEngine(room, 'a', a, { locks, Socket, request }),
    second = new SyncEngine(room, 'a', b, { locks, Socket, request });
  t.onTestFinished(async () => {
    await first.close();
    await second.close();
    await stores.cleanup();
  });
  await first.start();
  await second.start();
  await until(() => first.state.status === 'Connected');
  expect(FakeSocket.sockets).toHaveLength(1);
  await a.call('enqueue', 'send', { client_message_id: 'client-1', text: 'hello' }, 'operation');
  await until(() => FakeSocket.sockets[0].sent.some((c) => c.action === 'send'));
  const wire = FakeSocket.sockets[0].sent.find((c) => c.action === 'send');
  await first.close();
  await until(
    () =>
      FakeSocket.sockets.length === 2 &&
      FakeSocket.sockets[1].sent.some((c) => c.action === 'send'),
  );
  expect(FakeSocket.sockets[1].sent.find((c) => c.action === 'send')).toEqual(wire);
  FakeSocket.sockets[1].event({ type: 'snapshot', revision: 1, messages: [message] });
  FakeSocket.sockets[1].event({
    type: 'ack',
    id: 'operation',
    message_id: 'server-1',
    revision: 1,
  });
  await until(() => b.repository.read().operations.length === 0);
  expect(b.repository.read().messages).toHaveLength(1);
});
test('expired session preserves pending work as a local archive', async (t) => {
  environment();
  const stores = localStores(),
    store = await stores.open('room', 'a');
  await store.call('enqueue', 'send', { text: 'keep offline' }, 'queued');
  const engine = new SyncEngine({ room_id: 'room', recovery_token: 'secret' }, 'a', store, {
    locks: lockManager(),
    Socket,
    request: () => Promise.reject(new APIError('expired', 401)),
  });
  t.onTestFinished(async () => {
    await engine.close();
    await stores.cleanup();
  });
  await engine.start();
  await until(() => store.repository.read().expired);
  expect(store.repository.read().messages[0].text).toBe('keep offline');
  expect(store.repository.read().operations).toHaveLength(1);
});
test('stalled handshake explains the failure without losing its outbox', async (t) => {
  environment();
  class Silent extends FakeSocket {
    send(json: string) {
      this.sent.push(JSON.parse(json) as Record<string, unknown>);
    }
  }
  const stores = localStores(),
    store = await stores.open('room', 'a');
  await store.call('enqueue', 'send', { text: 'queued' }, 'queued');
  const engine = new SyncEngine({ room_id: 'room', recovery_token: 'secret' }, 'a', store, {
    locks: lockManager(),
    Socket: Silent as unknown as typeof WebSocket,
    request,
    connectTimeout: 20,
  });
  t.onTestFinished(async () => {
    await engine.close();
    await stores.cleanup();
  });
  await engine.start();
  await until(() => engine.state.status === 'Waiting for connection');
  expect(engine.state.reason).toMatch(/did not finish connecting/);
  expect(store.repository.read().operations).toHaveLength(1);
});

test('a failed local snapshot pauses synchronization instead of reconnecting repeatedly', async (t) => {
  environment();
  const stores = localStores(),
    store = await stores.open('room', 'b');
  const original = store.call.bind(store);
  store.call = (method, ...args) =>
    method === 'snapshot' ? Promise.reject(new Error('disk full')) : original(method, ...args);
  const errors: string[] = [];
  const engine = new SyncEngine({ room_id: 'room', recovery_token: 'secret' }, 'b', store, {
    locks: lockManager(),
    Socket,
    request,
    onError: (error) => errors.push(error),
  });
  t.onTestFinished(async () => {
    await engine.close();
    await stores.cleanup();
  });
  await engine.start();
  await until(() => engine.state.status === 'Sync paused');
  expect(errors).toEqual(['disk full']);
  expect(engine.retryTimer).toBeUndefined();
  expect(store.repository.read().operations).toHaveLength(0);
});
test('browser connectivity restoration retries immediately rather than waiting for backoff', async (t) => {
  environment();
  const events = new EventTarget(),
    stores = localStores(),
    store = await stores.open('room', 'a');
  let requests = 0;
  const request = (() =>
    ++requests === 1
      ? Promise.reject(new Error('network unavailable'))
      : Promise.resolve({ token: 'token' })) as typeof api;
  const engine = new SyncEngine({ room_id: 'room', recovery_token: 'secret' }, 'a', store, {
    locks: lockManager(),
    Socket,
    request,
    eventTarget: events as unknown as Window,
  });
  engine.attempt = 5;
  t.onTestFinished(async () => {
    await engine.close();
    await stores.cleanup();
  });
  await engine.start();
  await until(() => engine.state.status === 'Waiting for connection');
  events.dispatchEvent(new Event('online'));
  await until(() => engine.state.status === 'Connected');
  expect(requests).toBe(2);
});
