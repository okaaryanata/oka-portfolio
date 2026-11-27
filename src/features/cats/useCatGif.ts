import { useCallback, useEffect, useRef, useState } from 'react';
import { apiBase, errorMessage } from '../../shared/api';
export function useCatGif() {
  const [src, setSrc] = useState('/cat-still.png'),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    url = useRef<string | null>(null);
  const stop = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setSrc('/cat-still.png');
    setBusy(false);
    setStatus('Animation stopped.');
  }, []);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = (controller.current = new AbortController()),
      run = ++generation.current;
    setBusy(true);
    setStatus('Loading a random cat GIF…');
    let pending: string | undefined;
    try {
      const response = await fetch(apiBase + '/cats/gif', {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
        cache: 'no-store',
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/gif'))
        throw new Error('Cat provider unavailable.');
      pending = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.src = pending;
      await image.decode();
      if (run !== generation.current) {
        URL.revokeObjectURL(pending);
        return;
      }
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = pending;
      setSrc(pending);
      setStatus('Cat GIF loaded.');
    } catch (error) {
      if (pending) URL.revokeObjectURL(pending);
      if (run === generation.current) setStatus('Could not load a cat GIF. ' + errorMessage(error));
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    const counter = generation;
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      counter.current++;
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, [stop]);
  return { src, status, busy, load, stop, playing: src !== '/cat-still.png' };
}
