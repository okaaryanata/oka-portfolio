import { parseServerEvent } from '../types';
import type { Room, Actor, LocalStore, NetworkState, ServerEvent } from '../types';
interface Options {
  onState?: (state: NetworkState) => void;
  onError?: (message: string) => void;
  locks?: LockManager;
  Socket?: typeof WebSocket;
  request?: typeof api;
  connectTimeout?: number;
  eventTarget?: Window;
  channelFactory?: (name: string) => BroadcastChannel;
}
import { api, websocketURL, errorMessage, APIError } from '../../../shared/api';
export class SyncEngine {
  channel: BroadcastChannel;
  onState: (state: NetworkState) => void;
  onError: (message: string) => void;
  locks: LockManager;
  Socket: typeof WebSocket;
  request: typeof api;
  connectTimeout: number;
  eventTarget?: Window;
  state: NetworkState;
  aborter: AbortController;
  receiving: Promise<void>;
  closed = false;
  busy = false;
  attempt = 0;
  leader = false;
  storageBlocked = false;
  connecting = false;
  connectEpoch = 0;
  socket: WebSocket | null = null;
  retryTimer?: ReturnType<typeof setTimeout>;
  ackTimer?: ReturnType<typeof setTimeout>;
  connectTimer?: ReturnType<typeof setTimeout>;
  typingTimer?: ReturnType<typeof setTimeout>;
  inflight: string | null = null;
  unsubscribe?: () => void;
  release?: () => void;
  election?: Promise<unknown>;
  onlineListener?: () => void;

  constructor(
    public room: Room,
    public actor: Actor,
    public store: LocalStore,
    {
      onState = () => {},
      onError = () => {},
      locks = navigator.locks,
      Socket = WebSocket,
      request = api,
      connectTimeout = 10000,
      eventTarget = globalThis.window,
      channelFactory = (name) => new BroadcastChannel(name),
    }: Options = {},
  ) {
    this.onState = onState;
    this.onError = onError;
    this.locks = locks;
    this.Socket = Socket;
    this.request = request;
    this.connectTimeout = connectTimeout;
    this.eventTarget = eventTarget;
    this.channel = channelFactory('oka-sync:' + room.room_id + ':' + actor);
    this.channel.onmessage = ({
      data,
    }: {
      data: { type: string; enabled?: boolean; state: NetworkState };
    }) => {
      if (data.type === 'typing' && this.leader) this.sendTyping(!!data.enabled);
      else if (data.type === 'hello' && this.leader) this.announce();
      else if (data.type === 'reconnect' && this.leader) void this.reconnect();
      else if (data.type === 'state' && !this.leader) {
        this.state = data.state;
        onState(this.state);
      }
    };
    this.state = { reason: '', status: 'Connecting…', presence: null, typing: false };
    this.aborter = new AbortController();
    this.receiving = Promise.resolve();
    this.closed = false;
    this.busy = false;
    this.attempt = 0;
  }
  start() {
    this.onlineListener = () => {
      if (this.leader && !this.storageBlocked)
        this.reconnect().catch((error) => this.onError(errorMessage(error)));
    };
    this.eventTarget?.addEventListener('online', this.onlineListener);
    this.unsubscribe = this.store.subscribe(() => {
      void this.settingsChanged().catch((error) => this.onError(errorMessage(error)));
    });
    this.channel.postMessage({ type: 'hello' });
    this.election = this.locks
      .request(
        'oka-sync-owner:' + this.room.room_id + ':' + this.actor,
        { signal: this.aborter.signal },
        async () => {
          if (this.closed) return;
          this.leader = true;
          await this.settingsChanged();
          if (this.closed) return;
          await new Promise<void>((resolve) => (this.release = resolve));
          this.leader = false;
        },
      )
      .catch((error) => {
        if (!(error instanceof Error && error.name === 'AbortError'))
          this.onError(errorMessage(error));
      });
    return Promise.resolve(this);
  }
  announce() {
    this.onState(this.state);
    if (this.leader) this.channel.postMessage({ type: 'state', state: this.state });
  }
  status(value: string, reason = '') {
    this.state = { ...this.state, status: value, reason };
    this.announce();
  }
  async settingsChanged() {
    const local = await this.store.call('read');
    if (this.closed) return;
    if (local.expired) {
      this.disconnect();
      this.status('Expired — local archive');
      return;
    }
    if (!local.online) {
      this.disconnect();
      this.status('Offline');
      return;
    }
    if (!this.leader || this.storageBlocked) return;
    if (!this.socket && !this.connecting && !this.retryTimer) void this.connect();
    else void this.pump();
  }
  disconnect() {
    this.connectEpoch = (this.connectEpoch || 0) + 1;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    clearTimeout(this.ackTimer);
    clearTimeout(this.connectTimer);
    this.busy = false;
    this.inflight = null;
    const old = this.socket;
    this.socket = null;
    old?.close();
    this.state = { ...this.state, presence: null, typing: false };
    this.announce();
  }
  async connect() {
    if (this.closed || !this.leader) return;
    const epoch = (this.connectEpoch = (this.connectEpoch || 0) + 1);
    this.connecting = true;
    this.status('Signing in…');
    try {
      const session = await this.request<{ token: string }>('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({
          room_id: this.room.room_id,
          recovery_token: this.room.recovery_token,
          account_id: this.actor,
        }),
      });
      if (this.closed || epoch !== this.connectEpoch) return;
      const current = (this.socket = new this.Socket(websocketURL()));
      this.status('Connecting…');
      this.connectTimer = setTimeout(() => {
        if (current === this.socket && this.state.status !== 'Connected') {
          this.connectionFailed('The chat server did not finish connecting.');
        }
      }, this.connectTimeout);
      current.addEventListener('open', () => {
        if (current === this.socket)
          current.send(JSON.stringify({ type: 'auth', token: session.token }));
      });
      current.addEventListener('message', (event) => {
        if (current !== this.socket) return;
        this.receiving = this.receiving
          .then(async () => {
            if (current !== this.socket) return;
            await this.receive(parseServerEvent(String(event.data)));
          })
          .catch((error) => {
            this.storageBlocked = true;
            this.disconnect();
            this.status(
              'Sync paused',
              'Local synchronization needs attention. Your saved messages are retained. Try reconnecting.',
            );
            this.onError(errorMessage(error));
          });
      });
      current.addEventListener('close', (event) => {
        if (current !== this.socket || this.closed) return;
        this.connectionFailed(
          event.code === 1008
            ? 'The server refused this session. Retrying sign-in.'
            : 'The chat connection was interrupted.',
        );
      });
      current.addEventListener('error', () => {});
    } catch (error) {
      if (this.closed || epoch !== this.connectEpoch) return;
      if (error instanceof APIError && error.status === 401) {
        await this.store.call('update', { expired: true, online: false });
        this.status('Expired — local archive');
      } else {
        this.connectionFailed(errorMessage(error) || 'Cannot reach the chat server.');
      }
    } finally {
      this.connecting = false;
      if (!this.closed && epoch !== this.connectEpoch)
        this.settingsChanged().catch((error) => this.onError(errorMessage(error)));
    }
  }
  connectionFailed(reason: string) {
    this.disconnect();
    const delay = Math.min(1000 * 2 ** this.attempt++, 30000);
    this.status(
      'Waiting for connection',
      `${reason} Messages are saved on this device. Retrying automatically.`,
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.settingsChanged().catch((error) => this.onError(errorMessage(error)));
    }, delay);
  }
  async receive(event: ServerEvent) {
    if (event.type === 'snapshot') {
      const local = await this.store.call('snapshot', event);
      // Receipt creation follows the committed recipient SQLite transaction.
      const last = local.messages.filter((m) => m.sender_id !== this.actor && !m.delivered).at(-1);
      if (last) await this.store.call('enqueue', 'delivered', { message_id: last.id });
      clearTimeout(this.connectTimer);
      this.attempt = 0;
      this.status('Connected');
      void this.pump();
    } else if (event.type === 'ack') {
      await this.store.call('acknowledge', event);
      if (event.id === this.inflight) {
        this.busy = false;
        this.inflight = null;
        clearTimeout(this.ackTimer);
      }
      void this.pump();
    } else if (event.type === 'error') {
      if (event.retryable) {
        void this.reconnect();
        return;
      }
      await this.store.call('reject', event);
      if (event.id === this.inflight) {
        this.busy = false;
        this.inflight = null;
        clearTimeout(this.ackTimer);
      }
      this.onError(event.message);
      void this.pump();
    } else if (event.type === 'presence') {
      this.state = { ...this.state, presence: event.accounts };
      this.announce();
    } else if (event.type === 'typing') {
      this.state = { ...this.state, typing: event.enabled };
      clearTimeout(this.typingTimer);
      this.announce();
      if (event.enabled)
        this.typingTimer = setTimeout(() => {
          this.state = { ...this.state, typing: false };
          this.announce();
        }, 3000);
    }
  }
  async pump() {
    if (
      this.closed ||
      !this.leader ||
      this.busy ||
      this.state.status !== 'Connected' ||
      this.socket?.readyState !== 1
    )
      return;
    const activeSocket = this.socket,
      epoch = this.connectEpoch;
    this.busy = true;
    try {
      const local = await this.store.call('read');
      if (!local.online || local.expired) {
        this.busy = false;
        return;
      }
      const wire = await this.store.call('prepare');
      if (!wire) {
        this.busy = false;
        return;
      }
      if (this.closed || activeSocket !== this.socket || epoch !== this.connectEpoch) {
        return;
      }
      if (this.socket?.readyState !== 1) {
        this.busy = false;
        return;
      }
      this.inflight = wire.id;
      this.socket.send(JSON.stringify(wire));
      this.announce();
      this.ackTimer = setTimeout(() => {
        void this.reconnect();
      }, 10000);
    } catch (error) {
      if (epoch === this.connectEpoch) {
        this.busy = false;
        this.onError(errorMessage(error));
      }
    }
  }
  typing(enabled: boolean) {
    this.channel.postMessage({ type: 'typing', enabled });
    if (this.leader) this.sendTyping(enabled);
  }
  sendTyping(enabled: boolean) {
    if (this.socket?.readyState === 1 && this.state.status === 'Connected')
      this.socket.send(
        JSON.stringify({ type: 'command', id: crypto.randomUUID(), action: 'typing', enabled }),
      );
  }
  async reconnect() {
    if (this.closed) return;
    this.storageBlocked = false;
    if (!this.leader) {
      this.channel.postMessage({ type: 'reconnect' });
      return;
    }
    this.disconnect();
    await this.settingsChanged();
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.eventTarget?.removeEventListener('online', this.onlineListener!);
    this.unsubscribe?.();
    this.disconnect();
    clearTimeout(this.typingTimer);
    this.aborter.abort();
    this.release?.();
    await this.election;
    this.channel.close();
  }
}
