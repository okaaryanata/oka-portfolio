export const apiBase = (globalThis.PORTFOLIO_API_BASE || '/api/v1').replace(/\/$/, '');
export async function api(path, options = {}) {
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {'Content-Type':'application/json', ...options.headers},
    signal: options.signal || AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error?.message || 'The API request failed.'); error.status = response.status; throw error; }
  return data;
}
export function websocketURL() {
  const url = new URL(apiBase + '/chat/ws', location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
