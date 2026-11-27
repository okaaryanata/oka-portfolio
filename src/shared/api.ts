declare global {
  interface Window {
    PORTFOLIO_API_BASE?: string;
  }
}
export const apiBase = (
  (typeof window === 'undefined' ? undefined : window.PORTFOLIO_API_BASE) || '/api/v1'
).replace(/\/$/, '');
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBase + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal || AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data as { error?: { message?: string } };
    throw new APIError(error.error?.message || 'The API request failed.', response.status);
  }
  return data as T;
}
export function websocketURL() {
  const url = new URL(apiBase + '/chat/ws', location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred.';
