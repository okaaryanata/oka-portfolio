import { test, expect } from 'vitest';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react';
import { localStores, lockManager } from './helpers/node-local';
const base = process.env.API_SMOKE_URL;
test.skipIf(!base)(
  'React clients exchange messages, catch up offline, update previews and persist private/shared actions through the real proxy',
  async (t) => {
    window.PORTFOLIO_API_BASE = base + '/api/v1';
    const { ChatDemo } = await import('../src/features/chat/ui/ChatDemo');
    const { SyncEngine } = await import('../src/features/chat/sync/engine');
    const stores = localStores(),
      locks = lockManager();
    const result = render(
      <ChatDemo
        dependencies={{
          openStore: stores.open,
          createSync: (room, actor, store, callbacks) =>
            new SyncEngine(room, actor, store, { ...callbacks, locks, Socket: window.WebSocket }),
        }}
      />,
    );
    t.onTestFinished(async () => {
      result.unmount();
      await stores.cleanup();
      delete window.PORTFOLIO_API_BASE;
    });
    await waitFor(
      () => expect(result.container.querySelectorAll('.chat-connection')).toHaveLength(2),
      { timeout: 10000 },
    );
    await waitFor(
      () =>
        expect(
          [...result.container.querySelectorAll('.chat-connection')].map((e) => e.textContent),
        ).toEqual(['Connected', 'Connected']),
      { timeout: 10000 },
    );
    const pane = (actor: string) =>
        within(result.container.querySelector<HTMLElement>(`[data-account="${actor}"]`)!),
      a = pane('a'),
      b = pane('b');
    for (const history of result.container.querySelectorAll('.chat-history'))
      history.getBoundingClientRect = () => ({ top: 100, bottom: 400 }) as DOMRect;
    const send = async (who: typeof a, text: string) => {
      fireEvent.change(who.getByRole('textbox'), { target: { value: text } });
      fireEvent.submit(who.getByRole('textbox').closest('form')!);
      await waitFor(() => expect(who.getByRole('textbox')).toHaveValue(''));
    };
    const preview = (actor: string) =>
      result.container.querySelector(`[data-account="${actor}"] .chat-conversation-preview`)
        ?.textContent;
    const action = (who: typeof a, label: string, index = 0) => {
      const bubbles = who.getAllByRole('article');
      const scope = within(bubbles[index]);
      fireEvent.click(scope.getByLabelText('Message actions'));
      fireEvent.click(scope.getByText(label));
    };
    fireEvent.click(a.getByLabelText('Open conversation with Demo B'));
    await send(a, 'live hello');
    await waitFor(() => expect(preview('b')).toBe('live hello'));
    expect(b.getByLabelText('Open conversation with Demo A, 1 unread message')).toBeInTheDocument();
    await waitFor(() => expect(a.getByText(/Delivered/)).toBeInTheDocument());
    action(a, 'Edit');
    await send(a, 'live edited');
    await waitFor(() => expect(preview('b')).toBe('live edited'));
    action(a, 'Star');
    await waitFor(() => expect(a.getByText(/Starred/)).toBeInTheDocument());
    action(a, 'Pin');
    await waitFor(() => expect(a.getByText(/Pinned/)).toBeInTheDocument());
    fireEvent.click(b.getByLabelText('Account connection options'));
    fireEvent.click(b.getByText('Go offline'));
    await waitFor(() => expect(b.getByText('Offline')).toBeInTheDocument());
    fireEvent.click(a.getByLabelText('Account connection options'));
    fireEvent.click(a.getByText('Go offline'));
    await waitFor(() => expect(a.getByText('Offline')).toBeInTheDocument());
    await send(a, 'queued while offline');
    expect(
      stores.opened.find((s) => s.actor === 'a')!.repository.read().operations.length,
    ).toBeGreaterThan(0);
    fireEvent.click(a.getByLabelText('Account connection options'));
    fireEvent.click(a.getByText('Go online'));
    await waitFor(() => expect(a.getByText('Connected')).toBeInTheDocument());
    await waitFor(() =>
      expect(stores.opened.find((s) => s.actor === 'a')!.repository.read().operations).toHaveLength(
        0,
      ),
    );
    fireEvent.click(b.getByLabelText('Account connection options'));
    fireEvent.click(b.getByText('Go online'));
    await waitFor(() => expect(preview('b')).toBe('queued while offline'));
    fireEvent.click(b.getByRole('button', { name: /Open conversation with Demo A/ }));
    await waitFor(() => expect(a.getAllByText(/Read/).length).toBeGreaterThan(0));
    await send(b, 'reply after catchup');
    await waitFor(() => expect(preview('a')).toBe('reply after catchup'));
    await act(async () => {
      await stores.opened
        .find((s) => s.actor === 'b')!
        .call(
          'enqueue',
          'delete',
          {
            message_id: stores.opened
              .find((s) => s.actor === 'b')!
              .repository.read()
              .messages.at(-1)!.id,
          },
          'private-delete',
        );
    });
    await waitFor(() => expect(preview('b')).toBe('queued while offline'));
    expect(preview('a')).toBe('reply after catchup');
  },
  20000,
);
