export type Actor = 'a' | 'b';
export interface Room {
  room_id: string;
  recovery_token: string;
  saved_at?: number;
}
export type Action = 'send' | 'edit' | 'revoke' | 'delete' | 'star' | 'pin' | 'read' | 'delivered';
export interface Command {
  type: 'command';
  id: string;
  action: Action;
  message_id?: string;
  client_message_id?: string;
  text?: string;
  reply_to?: string;
  enabled?: boolean;
  expected_version?: number;
}
export interface Message {
  id: string;
  sender_id: Actor;
  client_message_id: string;
  text: string;
  created_at: number;
  version: number;
  revoked: boolean;
  delivered: boolean;
  read: boolean;
  starred: boolean;
  pinned: boolean;
  reply_to?: string;
  reply_text?: string;
  edited_at?: number;
  server_id?: string;
  status?: string;
}
export interface Conversation {
  peer: { id: Actor; name: string };
  unread_count: number;
  last_message: Message | null;
}
export interface Snapshot {
  type: 'snapshot';
  revision: number;
  messages: Message[];
  conversation?: Conversation;
}
export interface Ack {
  type: 'ack';
  id: string;
  message_id: string;
  revision: number;
}
export interface Rejection {
  type: 'error';
  id?: string;
  code?: string;
  message: string;
  retryable?: boolean;
}
export type ServerEvent =
  | Snapshot
  | Ack
  | Rejection
  | { type: 'presence'; accounts: Partial<Record<Actor, boolean>> }
  | { type: 'typing'; enabled: boolean };
export interface Operation {
  id: string;
  payload: Command;
  created_at: number;
  status: 'pending' | 'sending' | 'acknowledged' | 'failed';
  wire: Command | null;
  ack_revision?: number;
  error?: string;
  code?: string;
}
export interface Compose {
  editing?: string;
  replyTo?: string;
  savedDraft?: string;
}
export interface Settings {
  draft?: string;
  compose?: Compose;
  online?: boolean;
  expired?: boolean;
}
export interface LocalState {
  messages: Message[];
  conversation: Conversation;
  revision: number;
  draft: string;
  compose: Compose;
  online: boolean;
  expired: boolean;
  operations: Operation[];
  storage: string;
}
export interface NetworkState {
  status: string;
  reason?: string;
  presence: Partial<Record<Actor, boolean>> | null;
  typing: boolean;
}
export interface StoreMethods {
  read: [];
  enqueue: [Action, Partial<Command>?, string?, number?];
  snapshot: [Snapshot];
  acknowledge: [Ack];
  reject: [Rejection];
  prepare: [];
  update: [Settings];
  discard: [string];
  retry: [string, string?];
  clear: [];
}
export type StoreResult<K extends keyof StoreMethods> = K extends 'prepare'
  ? Command | null
  : LocalState;
export interface LocalStore {
  call<K extends keyof StoreMethods>(method: K, ...args: StoreMethods[K]): Promise<StoreResult<K>>;
  subscribe(fn: () => void): () => void;
  close(): Promise<void>;
  readonly hasUncommittedWrites?: boolean;
}
export function parseServerEvent(json: string): ServerEvent {
  const event: unknown = JSON.parse(json);
  if (!event || typeof event !== 'object' || !('type' in event))
    throw new Error('Invalid server event.');
  const e = event as Record<string, unknown>;
  if (
    e.type === 'snapshot' &&
    Number.isInteger(e.revision) &&
    Array.isArray(e.messages) &&
    e.messages.every(
      (m) =>
        m &&
        typeof m === 'object' &&
        typeof (m as Message).id === 'string' &&
        typeof (m as Message).text === 'string' &&
        ['a', 'b'].includes((m as Message).sender_id),
    )
  )
    return event as Snapshot;
  if (e.type === 'ack' && typeof e.id === 'string' && Number.isInteger(e.revision))
    return event as Ack;
  if (e.type === 'error' && typeof e.message === 'string') return event as Rejection;
  if (e.type === 'typing' && typeof e.enabled === 'boolean') return event as ServerEvent;
  if (e.type === 'presence' && e.accounts && typeof e.accounts === 'object')
    return event as ServerEvent;
  throw new Error('Unsupported server event.');
}
