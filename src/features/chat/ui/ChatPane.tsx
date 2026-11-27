import { useEffect, useRef, useState } from 'react';
import { Menu } from '../../../shared/ui/Menu';
import { errorMessage } from '../../../shared/api';
import type { Action, Actor, Command, Message, Room } from '../types';
import { useChatSession } from './useChatSession';
import type { ChatDependencies } from './useChatSession';
const receipt = (m: Message) =>
  m.status === 'Queued'
    ? 'Queued'
    : m.status === 'Sending'
      ? 'Sending…'
      : m.read
        ? 'Read'
        : m.delivered
          ? 'Delivered'
          : 'Sent';
export function ChatPane({
  room,
  actor,
  dependencies,
}: {
  room: Room;
  actor: Actor;
  dependencies?: ChatDependencies;
}) {
  const session = useChatSession(room, actor, dependencies),
    { state, network, error, setError } = session;
  const peer = actor === 'a' ? 'Demo B' : 'Demo A',
    peerID = actor === 'a' ? 'b' : 'a';
  const [detail, setDetail] = useState(false),
    [filter, setFilter] = useState('all'),
    [draft, setDraft] = useState(''),
    [editing, setEditing] = useState(''),
    [replyTo, setReplyTo] = useState(''),
    [savedDraft, setSavedDraft] = useState(''),
    [submitting, setSubmitting] = useState(false);
  const history = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    back = useRef<HTMLButtonElement>(null),
    open = useRef<HTMLButtonElement>(null),
    initialized = useRef(false),
    atBottom = useRef(true),
    readBusy = useRef(false),
    typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    lastTyped = useRef(0);
  useEffect(() => {
    if (state && !initialized.current) {
      initialized.current = true;
      setDraft(state.draft);
      setEditing(state.compose.editing || '');
      setReplyTo(state.compose.replyTo || '');
      setSavedDraft(state.compose.savedDraft || '');
    }
  }, [state]);
  useEffect(() => {
    if (atBottom.current && history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [state?.messages, filter, detail]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (submitting) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [submitting]);
  useEffect(() => () => clearTimeout(typingTimer.current), []);
  const visible =
    state?.messages.filter((m) =>
      filter === 'pinned' ? m.pinned : filter === 'starred' ? m.starred : true,
    ) || [];
  async function acknowledgeRead() {
    if (
      !state ||
      !detail ||
      filter !== 'all' ||
      !atBottom.current ||
      document.hidden ||
      state.expired ||
      readBusy.current
    )
      return;
    const bounds = history.current?.getBoundingClientRect(),
      top = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
    if (!bounds || bounds.bottom <= top || bounds.bottom > innerHeight) return;
    const last = state.messages
      .filter((m) => m.sender_id !== actor && !m.read && !m.revoked)
      .at(-1);
    if (!last) return;
    readBusy.current = true;
    try {
      await session.call('enqueue', 'read', { message_id: last.id }, crypto.randomUUID());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      readBusy.current = false;
    }
  }
  useEffect(() => {
    const check = () => void acknowledgeRead();
    check();
    window.addEventListener('scroll', check, { passive: true });
    document.addEventListener('visibilitychange', check);
    const observer = new IntersectionObserver(check);
    if (history.current) observer.observe(history.current);
    return () => {
      window.removeEventListener('scroll', check);
      document.removeEventListener('visibilitychange', check);
      observer.disconnect();
    };
  });
  async function command(action: Action, fields: Partial<Command> = {}) {
    await session.call('enqueue', action, fields, crypto.randomUUID());
  }
  function perform(action: () => void | Promise<void>) {
    setError('');
    void Promise.resolve()
      .then(action)
      .catch((e) => setError(errorMessage(e)));
  }
  function persist(text: string, edit = editing, reply = replyTo, saved = savedDraft) {
    perform(async () => {
      await session.call('update', {
        draft: text,
        compose: { editing: edit, replyTo: reply, savedDraft: saved },
      });
    });
  }
  async function submit() {
    if (!state || !draft.trim() || submitting || state.expired) return;
    const text = draft;
    setSubmitting(true);
    setError('');
    try {
      if (editing) {
        await command('edit', { message_id: editing, text });
        setDraft(savedDraft);
        await session.call('update', { draft: savedDraft, compose: {} });
      } else {
        await command('send', { text, client_message_id: crypto.randomUUID(), reply_to: replyTo });
        setDraft('');
        await session.call('update', { draft: '', compose: {} });
      }
      setEditing('');
      setReplyTo('');
      setSavedDraft('');
      atBottom.current = true;
      session.typing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }
  const unread = state?.conversation.unread_count || 0,
    last = state?.conversation.last_message,
    online = network.status === 'Connected' ? network.presence?.[peerID] : undefined,
    pending =
      state?.operations.filter((op) => ['pending', 'sending', 'acknowledged'].includes(op.status))
        .length || 0,
    all = filter === 'all';
  const actionButtons = (m: Message) => (
    <Menu label="Message actions" className="chat-message-menu">
      {!m.revoked && (
        <>
          <button
            onClick={() => {
              setEditing('');
              setReplyTo(m.id);
              persist(draft, '', m.id);
              composer.current?.focus();
            }}
          >
            Reply
          </button>
          <button
            onClick={() =>
              perform(async () => {
                await navigator.clipboard.writeText(m.text);
              })
            }
          >
            Copy
          </button>
          <button
            onClick={() =>
              perform(() => command('star', { message_id: m.id, enabled: !m.starred }))
            }
          >
            {m.starred ? 'Unstar' : 'Star'}
          </button>
          <button
            onClick={() => perform(() => command('pin', { message_id: m.id, enabled: !m.pinned }))}
          >
            {m.pinned ? 'Unpin' : 'Pin'}
          </button>
          {m.sender_id === actor && (
            <>
              <button
                onClick={() => {
                  setSavedDraft(draft);
                  setDraft(m.text);
                  setEditing(m.id);
                  setReplyTo('');
                  persist(m.text, m.id, '', draft);
                  composer.current?.focus();
                }}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm('Revoke this message for both demo accounts?'))
                    perform(() => command('revoke', { message_id: m.id }));
                }}
              >
                Revoke for both
              </button>
            </>
          )}
        </>
      )}
      <button onClick={() => perform(() => command('delete', { message_id: m.id }))}>
        Delete for me
      </button>
    </Menu>
  );
  return (
    <section
      className="chat-pane"
      data-account={actor}
      aria-label={`Demo ${actor.toUpperCase()} chat client`}
    >
      <div className="chat-pane-header">
        <div>
          <h3>Demo {actor.toUpperCase()}</h3>
          <p>Your conversations</p>
        </div>
        <div className="chat-account-tools">
          <span
            className="chat-connection"
            role="status"
            title={network.reason}
            data-state={network.status === 'Connected' ? 'connected' : 'waiting'}
          >
            {network.status}
          </span>
          <Menu label="Account connection options">
            <button
              className="chat-online-toggle"
              disabled={!state || state.expired}
              onClick={() =>
                perform(async () => {
                  await session.call('update', { online: !state?.online });
                })
              }
            >
              {state?.online ? 'Go offline' : 'Go online'}
            </button>
            <button className="chat-reconnect" onClick={() => perform(session.reconnect)}>
              Reconnect
            </button>
          </Menu>
        </div>
      </div>
      <p className="chat-local-status" role="status">
        {state?.expired
          ? 'Local archive — server room expired. Queued work is retained.'
          : pending
            ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync`
            : 'Saved on this device'}
      </p>
      <p className="chat-connection-help" role="status">
        {network.reason}
      </p>
      {state?.operations
        .filter((op) => op.status === 'failed')
        .map((op) => (
          <article className="chat-failures" key={op.id}>
            <strong>Unsynced {op.payload.action}</strong>
            <p>{op.error}</p>
            <blockquote>{op.payload.text}</blockquote>
            {!state.expired && (
              <button
                onClick={() =>
                  perform(async () => {
                    await session.call('retry', op.id);
                  })
                }
              >
                Retry with current version
              </button>
            )}
            <button
              onClick={() => perform(() => navigator.clipboard.writeText(op.payload.text || ''))}
            >
              Copy attempted text
            </button>
            <button
              onClick={() =>
                perform(async () => {
                  await session.call('discard', op.id);
                })
              }
            >
              Discard action
            </button>
          </article>
        ))}
      <div className="chat-conversation-list" hidden={detail}>
        <h4>Conversations</h4>
        <button
          ref={open}
          className={'chat-open-conversation' + (unread ? ' has-unread' : '')}
          aria-label={`Open conversation with ${peer}${unread ? `, ${unread} unread ${unread === 1 ? 'message' : 'messages'}` : ''}`}
          onClick={() => {
            setDetail(true);
            setFilter('all');
            atBottom.current = true;
            requestAnimationFrame(() => back.current?.focus());
          }}
        >
          <span className="chat-avatar" aria-hidden="true">
            {peerID.toUpperCase()}
          </span>
          <span className="chat-conversation-copy">
            <span className="chat-conversation-name">{peer}</span>
            <span className="chat-conversation-preview">
              {last
                ? (last.sender_id === actor ? 'You: ' : '') +
                  (last.revoked ? 'Message revoked' : last.text)
                : 'No messages yet'}
            </span>
          </span>
          <span className="chat-conversation-indicators">
            <time className="chat-conversation-time">
              {last
                ? new Date(last.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </time>
            <span className="chat-unread-dot" hidden={!unread} />
          </span>
          <span className="chat-unread-label sr-only" aria-live="polite">
            {unread ? `${unread} unread ${unread === 1 ? 'message' : 'messages'}` : ''}
          </span>
        </button>
      </div>
      <div className="chat-detail" hidden={!detail}>
        <div className="chat-detail-heading">
          <button
            ref={back}
            className="chat-icon chat-back"
            aria-label={all ? 'Back to conversations' : 'Back to all messages'}
            onClick={() => {
              if (!all) {
                setFilter('all');
                atBottom.current = true;
              } else {
                setDetail(false);
                session.typing(false);
                open.current?.focus();
              }
            }}
          >
            ←
          </button>
          <div className="chat-detail-title">
            <h4>{all ? peer : filter === 'pinned' ? 'Pinned messages' : 'Starred messages'}</h4>
            {all ? (
              <span className="chat-peer-presence" data-presence={online ? 'online' : 'offline'}>
                {typeof online === 'boolean' ? (online ? 'Online' : 'Offline') : 'Unknown'}
              </span>
            ) : (
              <span className="chat-view-caption">
                {filter === 'pinned' ? `Shared with ${peer}` : 'Only visible to you'}
              </span>
            )}
          </div>
          {all && (
            <Menu label="Conversation options" className="chat-view-menu">
              <button
                onClick={() => {
                  setFilter('pinned');
                  atBottom.current = true;
                  back.current?.focus();
                }}
              >
                Pinned messages
              </button>
              <button
                onClick={() => {
                  setFilter('starred');
                  atBottom.current = true;
                  back.current?.focus();
                }}
              >
                Starred messages
              </button>
            </Menu>
          )}
        </div>
        <div
          ref={history}
          className="chat-history"
          role="region"
          aria-label={`Demo ${actor.toUpperCase()} conversation`}
          tabIndex={0}
          onScroll={() => {
            const el = history.current;
            if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
            void acknowledgeRead();
          }}
        >
          {!visible.length && (
            <p className="chat-empty">
              {all ? 'Send a message to begin.' : 'No messages in this view.'}
            </p>
          )}
          {visible.map((m) => (
            <article
              className={'chat-message' + (m.sender_id === actor ? ' own' : '')}
              key={m.id}
              data-message-id={m.id}
            >
              <p className="chat-author">{m.sender_id === actor ? 'You' : peer}</p>
              {m.reply_to && (
                <blockquote className="chat-reply">
                  {m.reply_text || 'Message unavailable'}
                </blockquote>
              )}
              <p className="chat-text">{m.revoked ? 'Message revoked' : m.text}</p>
              <p className="chat-meta">
                {[
                  new Date(m.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  m.edited_at ? 'Edited' : '',
                  m.starred ? 'Starred' : '',
                  m.pinned ? 'Pinned' : '',
                  m.sender_id === actor ? receipt(m) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {actionButtons(m)}
            </article>
          ))}
        </div>
        {all && (
          <>
            <p className="chat-typing" aria-live="polite">
              {network.typing ? `${peer} is typing…` : ''}
            </p>
            {(editing || replyTo) && (
              <>
                <p className="chat-context">
                  {editing ? 'Editing your message' : 'Replying to a message'}
                </p>
                <button
                  className="chat-cancel"
                  onClick={() => {
                    const text = editing ? savedDraft : draft;
                    setDraft(text);
                    setEditing('');
                    setReplyTo('');
                    persist(text, '', '', '');
                  }}
                >
                  Cancel reply / edit
                </button>
              </>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="sr-only" htmlFor={`chat-input-${actor}`}>
                Message to {peer}
              </label>
              <textarea
                id={`chat-input-${actor}`}
                ref={composer}
                rows={2}
                maxLength={2000}
                value={draft}
                disabled={!state || state.expired || submitting}
                placeholder="Write a message…"
                onChange={(e) => {
                  setDraft(e.target.value);
                  persist(e.target.value);
                  const now = Date.now();
                  if (now - lastTyped.current > 800) {
                    session.typing(!!e.target.value);
                    lastTyped.current = now;
                  }
                  clearTimeout(typingTimer.current);
                  typingTimer.current = setTimeout(() => session.typing(false), 1500);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="chat-send">
                <span>Enter to send · Shift+Enter for a new line</span>
                <button
                  type="submit"
                  className="button primary"
                  disabled={!state || state.expired || submitting}
                >
                  {editing ? 'Save edit' : 'Send'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      <p className="chat-notice" role="status">
        {error}
      </p>
    </section>
  );
}
