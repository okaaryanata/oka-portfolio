import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../../shared/api';
import type { Room } from '../types';
import { ChatPane } from './ChatPane';
import { openBrowserStore } from '../persistence/store';
import type { ChatDependencies } from './useChatSession';
const storageKey = 'oka-chat-demo-v1',
  registryKey = 'oka-chat-local-rooms-v1';
function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) || 'null') as T) || fallback;
  } catch {
    return fallback;
  }
}
function remember(room: Room) {
  const rooms = read<Room[]>(registryKey, []);
  if (!rooms.some((r) => r.room_id === room.room_id)) rooms.push({ ...room, saved_at: Date.now() });
  localStorage.setItem(registryKey, JSON.stringify(rooms));
  localStorage.setItem(storageKey, JSON.stringify(room));
  return room;
}
let creating: Promise<Room> | null = null;
async function loadRoom() {
  const saved = read<Room | null>(storageKey, null);
  if (saved?.room_id && saved.recovery_token) return saved;
  creating ??= api<Room>('/chat/demos', { method: 'POST', body: '{}' })
    .then(remember)
    .finally(() => {
      creating = null;
    });
  return creating;
}
export function ChatDemo({
  dependencies,
  initialRoom,
}: {
  dependencies?: ChatDependencies;
  initialRoom?: Room;
}) {
  const [room, setRoom] = useState<Room | null>(initialRoom || null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!initialRoom),
    [rooms, setRooms] = useState(() => read<Room[]>(registryKey, []));
  useEffect(() => {
    if (initialRoom) return;
    let active = true;
    void loadRoom()
      .then((value) => {
        if (active) {
          setRoom(value);
          setRooms(read<Room[]>(registryKey, []));
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [initialRoom]);
  async function fresh() {
    if (!confirm('Start a fresh demo? Your saved history and queued work stay in Saved demos.'))
      return;
    setLoading(true);
    setError('');
    try {
      const value = remember(await api<Room>('/chat/demos', { method: 'POST', body: '{}' }));
      setRoom(value);
      setRooms(read<Room[]>(registryKey, []));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  async function clear() {
    if (
      !room ||
      !confirm(
        'Clear this demo’s local history, drafts and queued actions for both accounts? This cannot be undone.',
      )
    )
      return;
    try {
      for (const actor of ['a', 'b'] as const) {
        const store = await (dependencies?.openStore || openBrowserStore)(room.room_id, actor);
        try {
          await store.call('clear');
        } finally {
          await store.close();
        }
      }
      const remaining = rooms.filter((r) => r.room_id !== room.room_id);
      localStorage.setItem(registryKey, JSON.stringify(remaining));
      localStorage.removeItem(storageKey);
      setRooms(remaining);
      setRoom(null);
      setError('Local data cleared. Start a new demo to continue.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div id="chat-app">
      <div className="controls">
        <button
          className="button"
          id="new-chat-demo"
          disabled={loading}
          onClick={() => void fresh()}
        >
          New demo
        </button>
        <label>
          Saved demos
          <select
            aria-label="Saved chat demos"
            value={room?.room_id || ''}
            onChange={(e) => {
              const selected = rooms.find((r) => r.room_id === e.target.value);
              if (selected) {
                remember(selected);
                setRoom(selected);
              }
            }}
          >
            {rooms.map((r) => (
              <option key={r.room_id} value={r.room_id}>
                Demo saved {r.saved_at ? new Date(r.saved_at).toLocaleString() : 'earlier session'}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          id="clear-chat-local"
          onClick={() => void clear()}
          disabled={!room}
        >
          Clear local data
        </button>
        <p id="chat-status" role="status">
          {error ||
            (loading
              ? 'Opening your locally saved conversations…'
              : 'Messages save locally first. Each account synchronizes independently when online.')}
        </p>
      </div>
      <p className="note">
        These pre-registered identities share an isolated demo room. Each account has its own local
        database. Server rooms expire after 24 inactive hours; local history stays until you clear
        it. Use demo messages only.
      </p>
      {room && (
        <div className="chat-clients">
          {(['a', 'b'] as const).map((actor) => (
            <ChatPane
              key={room.room_id + actor}
              room={room}
              actor={actor}
              dependencies={dependencies}
            />
          ))}
        </div>
      )}
    </div>
  );
}
