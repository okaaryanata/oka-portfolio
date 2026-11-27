// @vitest-environment node
import { test } from 'vitest';
import type { TestContext } from 'vitest';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import type { Actor, Message } from '../src/features/chat/types';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../src/features/chat/persistence/repository';
function open(path: string, actor: Actor = 'a', room = 'room') {
  const db = new DatabaseSync(path);
  const adapter = {
    exec(sql: string, bind: unknown[] = []) {
      if (bind.length) db.prepare(sql).run(...(bind as SQLInputValue[]));
      else db.exec(sql);
    },
    query(sql: string, bind: unknown[] = []) {
      return db.prepare(sql).all(...(bind as SQLInputValue[]));
    },
  };
  return { db, adapter, repo: new Repository(adapter, room, actor) };
}
function fixture(t: TestContext, actor: Actor = 'a') {
  const path = join(mkdtempSync(join(tmpdir(), 'oka-local-')), 'client.db');
  const f = open(path, actor);
  t.onTestFinished(() => f.db.close());
  return { ...f, path };
}
const message = (values: Partial<Message> = {}): Message => ({
  id: 'server-1',
  client_message_id: 'client-1',
  sender_id: 'a',
  text: 'hello',
  version: 1,
  created_at: 1,
  delivered: false,
  read: false,
  revoked: false,
  starred: false,
  pinned: false,
  ...values,
});
test('local message and outbox survive database close before any network call', (t) => {
  const path = join(mkdtempSync(join(tmpdir(), 'oka-local-')), 'client.db');
  let f = open(path);
  f.repo.update({ draft: 'hello', online: false });
  f.repo.enqueue('send', { client_message_id: 'client-1', text: 'hello' }, 'send-1', 1);
  f.db.close();
  f = open(path);
  t.onTestFinished(() => f.db.close());
  const local = f.repo.read();
  assert.equal(local.messages[0].text, 'hello');
  assert.equal(local.messages[0].status, 'Queued');
  assert.equal(local.operations.length, 1);
  assert.equal(local.draft, '');
  assert.equal(local.online, false);
});
test('failed local commit rolls back message/outbox and preserves draft', (t) => {
  const { repo, adapter } = fixture(t);
  repo.update({ draft: 'keep me' });
  const exec = adapter.exec.bind(adapter);
  adapter.exec = (sql, bind) => {
    if (sql === 'COMMIT') throw new Error('disk full');
    return exec(sql, bind);
  };
  assert.throws(() => repo.enqueue('send', { text: 'hello' }, 'one'), /disk full/);
  adapter.exec = exec;
  assert.equal(repo.read().messages.length, 0);
  assert.equal(repo.read().operations.length, 0);
  assert.equal(repo.read().draft, 'keep me');
});
test('sender and recipient SQLite files remain independent', (t) => {
  const a = fixture(t, 'a'),
    b = fixture(t, 'b');
  a.repo.enqueue('send', { client_message_id: 'client-1', text: 'hello' }, 'send');
  assert.equal(b.repo.read().messages.length, 0);
  b.repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  assert.equal(b.repo.read().messages[0].text, 'hello');
  assert.equal(b.repo.read().conversation.unread_count, 1);
  assert.throws(() => new Repository(a.adapter, 'room', 'b'), /mismatch/);
});
test('snapshot merges with durable outbox and ack only settles after persisted revision', (t) => {
  const { repo } = fixture(t);
  repo.enqueue('send', { client_message_id: 'client-1', text: 'hello' }, 'send');
  const wire = repo.prepare()!;
  assert.equal(wire.id, 'send');
  assert.deepEqual(repo.prepare()!, wire);
  repo.acknowledge({ type: 'ack', id: 'send', message_id: 'server-1', revision: 2 });
  assert.equal(repo.read().operations.length, 1);
  repo.snapshot({ type: 'snapshot', revision: 1, messages: [] });
  assert.equal(repo.read().messages.length, 1);
  repo.snapshot({ type: 'snapshot', revision: 2, messages: [message()] });
  assert.equal(repo.read().messages.length, 1);
  assert.equal(repo.read().messages[0].id, 'local:client-1');
  assert.equal(repo.read().operations.length, 0);
  repo.snapshot({ type: 'snapshot', revision: 1, messages: [] });
  assert.equal(repo.read().messages.length, 1);
});
test('offline dependent edits/replies resolve IDs without altering prepared payloads', (t) => {
  const { repo } = fixture(t);
  repo.enqueue('send', { client_message_id: 'client-1', text: 'hello' }, 'send', 1);
  repo.enqueue('edit', { message_id: 'local:client-1', text: 'edited' }, 'edit', 2);
  repo.enqueue(
    'send',
    { client_message_id: 'reply', text: 'response', reply_to: 'local:client-1' },
    'reply',
    3,
  );
  assert.equal(repo.read().messages[0].text, 'edited');
  assert.equal(repo.prepare()!.text, 'hello');
  repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  repo.acknowledge({ type: 'ack', id: 'send', message_id: 'server-1', revision: 1 });
  const edit = repo.prepare()!;
  assert.equal(edit.message_id, 'server-1');
  assert.equal(edit.expected_version, 1);
  repo.snapshot({
    type: 'snapshot',
    revision: 2,
    messages: [message({ text: 'edited', version: 2 })],
  });
  repo.acknowledge({ type: 'ack', id: 'edit', message_id: 'server-1', revision: 2 });
  assert.equal(repo.prepare()!.reply_to, 'server-1');
});
test('conflicting edit retains attempted text and explicit retry uses a new ID/version', (t) => {
  const { repo } = fixture(t);
  repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  repo.enqueue('edit', { message_id: 'local:client-1', text: 'my offline edit' }, 'edit');
  repo.prepare()!;
  repo.snapshot({
    type: 'snapshot',
    revision: 2,
    messages: [message({ text: 'new server version', version: 2 })],
  });
  repo.reject({ type: 'error', id: 'edit', code: 'version_conflict', message: 'review' });
  const local = repo.read();
  assert.equal(local.messages[0].text, 'new server version');
  assert.equal(local.operations[0].payload.text, 'my offline edit');
  repo.retry('edit');
  const next = repo.prepare()!;
  assert.notEqual(next.id, 'edit');
  assert.equal(next.expected_version, 2);
  assert.equal(next.text, 'my offline edit');
});
test('local deletes, revokes and read state update private previews immediately', (t) => {
  const { repo } = fixture(t, 'b');
  repo.snapshot({
    type: 'snapshot',
    revision: 2,
    messages: [
      message(),
      message({ id: 'server-2', client_message_id: 'client-2', text: 'second' }),
    ],
  });
  repo.enqueue('read', { message_id: 'server-2' }, 'read');
  assert.equal(repo.read().conversation.unread_count, 0);
  repo.enqueue('delete', { message_id: 'server-2' }, 'delete');
  assert.equal(repo.read().conversation.last_message!.text, 'hello');
  repo.snapshot({
    type: 'snapshot',
    revision: 3,
    messages: [message(), message({ id: 'server-2', text: 'second' })],
  });
  assert.equal(repo.read().conversation.last_message!.text, 'hello');
});
test('expired room keeps local history and pending work and blocks new sends', (t) => {
  const { repo } = fixture(t);
  repo.enqueue('send', { text: 'queued' }, 'one');
  repo.update({ expired: true, online: false });
  assert.equal(repo.read().messages[0].text, 'queued');
  assert.equal(repo.read().operations.length, 1);
  assert.throws(() => repo.enqueue('send', { text: 'new' }, 'two'), /expired/);
});
test('all supported offline mutations persist and update the local projection', (t) => {
  const path = join(mkdtempSync(join(tmpdir(), 'oka-actions-')), 'client.db');
  let f = open(path);
  f.repo.snapshot({
    type: 'snapshot',
    revision: 1,
    messages: [
      message(),
      message({
        id: 'incoming',
        client_message_id: 'incoming-client',
        sender_id: 'b',
        text: 'from B',
      }),
    ],
  });
  f.repo.update({ online: false });
  for (const [action, fields] of [
    ['star', { message_id: 'local:client-1', enabled: true }],
    ['pin', { message_id: 'incoming', enabled: true }],
    ['edit', { message_id: 'local:client-1', text: 'offline edit' }],
    ['read', { message_id: 'incoming' }],
    ['send', { client_message_id: 'reply', text: 'offline reply', reply_to: 'incoming' }],
    ['delete', { message_id: 'incoming' }],
    ['revoke', { message_id: 'local:client-1' }],
  ] as const)
    f.repo.enqueue(action, fields, action);
  f.db.close();
  f = open(path);
  t.onTestFinished(() => f.db.close());
  const state = f.repo.read();
  assert.equal(state.operations.length, 7);
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[0].text, '');
  assert.equal(state.messages[0].revoked, true);
  assert.equal(state.messages[1].reply_text, 'Message unavailable');
  assert.equal(state.conversation.unread_count, 0);
  assert.equal(state.conversation.last_message!.text, 'offline reply');
});
test('recipient crash after local commit preserves its pending delivery receipt without duplicates', (t) => {
  const path = join(mkdtempSync(join(tmpdir(), 'oka-receipt-')), 'client.db');
  let f = open(path, 'b');
  f.repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  f.repo.enqueue('delivered', { message_id: 'server-1' }, 'receipt');
  f.db.close();
  f = open(path, 'b');
  t.onTestFinished(() => f.db.close());
  f.repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  f.repo.enqueue('delivered', { message_id: 'server-1' }, 'another-receipt');
  assert.equal(f.repo.read().operations.length, 1);
  assert.equal(f.repo.read().messages[0].delivered, true);
});
test('unfinished edit and reply drafts survive reopen with their compose context', (t) => {
  const path = join(mkdtempSync(join(tmpdir(), 'oka-compose-')), 'client.db');
  let f = open(path);
  f.repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  f.repo.update({
    draft: 'unfinished edit',
    compose: { editing: 'local:client-1', replyTo: '', savedDraft: 'earlier draft' },
  });
  f.db.close();
  f = open(path);
  t.onTestFinished(() => f.db.close());
  assert.equal(f.repo.read().draft, 'unfinished edit');
  assert.equal(f.repo.read().compose.editing, 'local:client-1');
  assert.equal(f.repo.read().compose.savedDraft, 'earlier draft');
});
test('clearing local data prevents a late network snapshot from restoring the deleted history', (t) => {
  const { repo } = fixture(t);
  repo.snapshot({ type: 'snapshot', revision: 1, messages: [message()] });
  repo.clear();
  repo.snapshot({ type: 'snapshot', revision: 2, messages: [message()] });
  assert.equal(repo.read().messages.length, 0);
  assert.equal(repo.read().expired, true);
});
