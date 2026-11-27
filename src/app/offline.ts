// Development assets change on every edit. Production caches only built static assets.
export async function configureOffline() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations)
      if (registration.active?.scriptURL === new URL('/sw.js', location.origin).href)
        await registration.unregister();
    for (const key of await caches.keys())
      if (key.startsWith('oka-chat-shell-')) await caches.delete(key);
  } else await navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
