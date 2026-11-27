import { useEffect, useRef, useState } from 'react';
import { openBrowserStore } from '../persistence/store';
import { SyncEngine } from '../sync/engine';
import type {
  Actor,
  LocalState,
  LocalStore,
  NetworkState,
  Room,
  StoreMethods,
  StoreResult,
} from '../types';
import { errorMessage } from '../../../shared/api';
export interface Engine {
  start: () => Promise<unknown>;
  close: () => Promise<void>;
  reconnect: () => Promise<void>;
  typing: (enabled: boolean) => void;
}
export interface ChatDependencies {
  openStore: (room: string, actor: Actor) => Promise<LocalStore>;
  createSync: (
    room: Room,
    actor: Actor,
    store: LocalStore,
    callbacks: { onState: (state: NetworkState) => void; onError: (message: string) => void },
  ) => Engine;
}
const defaults: ChatDependencies = {
  openStore: openBrowserStore,
  createSync: (...args) => new SyncEngine(...args),
};
export function useChatSession(
  room: Room,
  actor: Actor,
  dependencies: ChatDependencies = defaults,
) {
  const [state, setState] = useState<LocalState | null>(null),
    [network, setNetwork] = useState<NetworkState>({
      status: 'Opening local storage…',
      presence: null,
      typing: false,
    }),
    [error, setError] = useState('');
  const resources = useRef<{ store: LocalStore; engine: Engine } | null>(null);
  useEffect(() => {
    let active = true;
    let local: LocalStore | undefined, engine: Engine | undefined;
    let unsubscribe: (() => void) | undefined;
    let reads = Promise.resolve();
    const refresh = () => {
      reads = reads
        .then(async () => {
          if (active && local) {
            const value = await local.call('read');
            if (active) setState(value);
          }
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        });
    };
    void (async () => {
      try {
        local = await dependencies.openStore(room.room_id, actor);
        if (!active) {
          await local.close();
          return;
        }
        const initial = await local.call('read');
        if (!active) {
          await local.close();
          return;
        }
        setState(initial);
        unsubscribe = local.subscribe(refresh);
        engine = dependencies.createSync(room, actor, local, {
          onState: (value) => {
            if (active) setNetwork(value);
          },
          onError: (message) => {
            if (active) setError(message);
          },
        });
        resources.current = { store: local, engine };
        await engine.start();
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (local?.hasUncommittedWrites) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const pageHide = () => {
      active = false;
      unsubscribe?.();
      void engine?.close().then(() => local?.close());
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', pageHide);
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) location.reload();
    };
    window.addEventListener('pageshow', pageShow);
    return () => {
      active = false;
      resources.current = null;
      unsubscribe?.();
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', pageShow);
      void (async () => {
        await engine?.close();
        await reads;
        await local?.close();
      })();
    };
  }, [room.room_id, room.recovery_token, actor, dependencies]);
  async function call<K extends keyof StoreMethods>(
    method: K,
    ...args: StoreMethods[K]
  ): Promise<StoreResult<K>> {
    const resource = resources.current;
    if (!resource) throw new Error('Local storage is not ready.');
    return resource.store.call(method, ...args);
  }
  return {
    state,
    network,
    error,
    setError,
    call,
    typing: (enabled: boolean) => resources.current?.engine.typing(enabled),
    reconnect: async () => {
      setError('');
      await call('update', { online: true });
      await resources.current?.engine.reconnect();
    },
  };
}
