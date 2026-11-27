import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BoundFunctions, queries } from '@testing-library/dom';
import { test, expect, vi } from 'vitest';
import { ChatDemo } from '../src/features/chat/ui/ChatDemo';
import { localStores } from './helpers/node-local';
import type { ChatDependencies } from '../src/features/chat/ui/useChatSession';
import type { Message, Actor } from '../src/features/chat/types';
const room = { room_id: 'room', recovery_token: 'secret' };
const message = (values: Partial<Message> = {}): Message => ({
  id: 'server-1',
  client_message_id: 'client-1',
  sender_id: 'a',
  text: 'hello',
  version: 1,
  created_at: 1,
  revoked: false,
  delivered: false,
  read: false,
  starred: false,
  pinned: false,
  ...values,
});
async function setup() {
  const stores = localStores();
  const dependencies: ChatDependencies = {
    openStore: stores.open,
    createSync: (_room, _actor, store, callbacks) => {
      let unsubscribe: (() => void) | undefined,
        status = '';
      const notify = async () => {
        const state = await store.call('read'),
          next = state.expired ? 'Expired — local archive' : state.online ? 'Connected' : 'Offline';
        if (next !== status) {
          status = next;
          callbacks.onState({
            status,
            presence: next === 'Connected' ? { a: true, b: true } : null,
            typing: false,
          });
        }
      };
      return {
        async start() {
          unsubscribe = store.subscribe(() => {
            void notify();
          });
          await notify();
        },
        typing() {},
        reconnect: notify,
        close() {
          unsubscribe?.();
          return Promise.resolve();
        },
      };
    },
  };
  const result = render(<ChatDemo initialRoom={room} dependencies={dependencies} />);
  await waitFor(() => expect(stores.opened.length).toBe(2));
  await waitFor(() => expect(screen.getAllByText('Connected')).toHaveLength(2));
  const pane = (actor: Actor) =>
      within(result.container.querySelector<HTMLElement>(`[data-account="${actor}"]`)!),
    store = (actor: Actor) => stores.opened.find((s) => s.actor === actor)!;
  return { ...result, stores, pane, store };
}
async function send(pane: BoundFunctions<typeof queries>, text: string) {
  fireEvent.change(pane.getByRole('textbox'), { target: { value: text } });
  fireEvent.submit(pane.getByRole('textbox').closest('form')!);
  await waitFor(() => expect(pane.getByRole('textbox')).toHaveValue(''));
}
test('conversation list opens all messages and offline send commits before composer clears', async (t) => {
  const app = await setup();
  t.onTestFinished(async () => {
    app.unmount();
    await app.stores.cleanup();
  });
  const a = app.pane('a');
  expect(a.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(a.getByText('Go offline'));
  await a.findByText('Offline');
  fireEvent.click(a.getByLabelText('Open conversation with Demo B'));
  await send(a, 'offline message');
  expect(app.store('a').repository.read().operations[0].payload.text).toBe('offline message');
  expect(a.getByText('offline message')).toBeInTheDocument();
  expect(app.store('b').repository.read().messages).toHaveLength(0);
});
test('unread stays on the list until eligible detail viewing', async (t) => {
  const app = await setup();
  t.onTestFinished(async () => {
    app.unmount();
    await app.stores.cleanup();
  });
  await act(() =>
    app.store('b').call('snapshot', { type: 'snapshot', revision: 1, messages: [message()] }),
  );
  const b = app.pane('b');
  await b.findByLabelText('Open conversation with Demo A, 1 unread message');
  expect(app.store('b').repository.read().operations).toHaveLength(0);
  const history = app.container.querySelector('[data-account="b"] .chat-history')!;
  vi.spyOn(history, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 400 } as DOMRect);
  fireEvent.click(b.getByLabelText('Open conversation with Demo A, 1 unread message'));
  await waitFor(() =>
    expect(app.store('b').repository.read().operations[0].payload.action).toBe('read'),
  );
});
test('pinned and starred views return to all messages before returning to the list', async (t) => {
  const app = await setup();
  t.onTestFinished(async () => {
    app.unmount();
    await app.stores.cleanup();
  });
  await act(() =>
    app.store('a').call('snapshot', {
      type: 'snapshot',
      revision: 1,
      messages: [
        message({ pinned: true }),
        message({ id: 'second', client_message_id: 'two', text: 'favorite', starred: true }),
      ],
    }),
  );
  const a = app.pane('a');
  fireEvent.click(a.getByLabelText('Open conversation with Demo B'));
  const menu = a.getByLabelText('Conversation options').closest('details')!;
  fireEvent.click(a.getByLabelText('Conversation options'));
  expect(menu.open).toBe(true);
  fireEvent.click(a.getByText('Pinned messages'));
  expect(menu.open).toBe(false);
  expect(a.getByRole('heading', { name: 'Pinned messages' })).toBeInTheDocument();
  expect(a.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(a.getByLabelText('Back to all messages'));
  expect(a.getByRole('textbox')).toBeInTheDocument();
  fireEvent.click(a.getByLabelText('Conversation options'));
  fireEvent.click(a.getByText('Starred messages'));
  expect(a.getByText('favorite')).toBeInTheDocument();
  fireEvent.click(a.getByLabelText('Back to all messages'));
  fireEvent.click(a.getByLabelText('Back to conversations'));
  expect(a.queryByRole('textbox')).not.toBeInTheDocument();
});
test('edited and revoked previews update while personal deletion stays private', async (t) => {
  const app = await setup();
  t.onTestFinished(async () => {
    app.unmount();
    await app.stores.cleanup();
  });
  const store = app.store('b'),
    b = app.pane('b');
  await act(() => store.call('snapshot', { type: 'snapshot', revision: 1, messages: [message()] }));
  await b.findByText('hello', { selector: '.chat-conversation-preview' });
  await act(() =>
    store.call('snapshot', {
      type: 'snapshot',
      revision: 2,
      messages: [message({ text: 'edited', version: 2 })],
    }),
  );
  await b.findByText('edited', { selector: '.chat-conversation-preview' });
  await act(() =>
    store.call('snapshot', {
      type: 'snapshot',
      revision: 3,
      messages: [message({ text: '', revoked: true, version: 3 })],
    }),
  );
  await b.findByText('Message revoked', { selector: '.chat-conversation-preview' });
  await act(() => store.call('enqueue', 'delete', { message_id: 'server-1' }, 'hide'));
  await b.findByText('No messages yet');
});
test('failed edits retain attempted text and allow explicit review', async (t) => {
  const app = await setup();
  t.onTestFinished(async () => {
    app.unmount();
    await app.stores.cleanup();
  });
  const store = app.store('a');
  await act(async () => {
    await store.call('snapshot', { type: 'snapshot', revision: 1, messages: [message()] });
    await store.call(
      'enqueue',
      'edit',
      { message_id: 'local:client-1', text: 'attempted' },
      'edit',
    );
    await store.call('snapshot', {
      type: 'snapshot',
      revision: 2,
      messages: [message({ text: 'server version', version: 2 })],
    });
    await store.call('reject', {
      type: 'error',
      id: 'edit',
      code: 'version_conflict',
      message: 'message changed',
    });
  });
  const a = app.pane('a');
  await a.findByText('attempted');
  expect(a.getByText('Retry with current version')).toBeInTheDocument();
  fireEvent.click(a.getByText('Discard action'));
  await waitFor(() => expect(store.repository.read().operations).toHaveLength(0));
});
