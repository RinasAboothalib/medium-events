// Talks to the MEDIUM server (/api, same origin; Vite proxies it in development).
// The session lives in an HttpOnly cookie the browser sends automatically.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Listener = (error: ApiError) => void;
const listeners = new Set<Listener>();

// The auth provider listens for 401 (signed out) and password_change_required responses
export function onApiError(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportApiError(error: ApiError) {
  listeners.forEach((listener) => listener(error));
}

const UNREACHABLE = "Can't reach the MEDIUM server. Check it's running and try again.";

async function request<T>(method: string, path: string, body?: unknown, file?: Blob): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: file ? { 'Content-Type': file.type } : body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: file ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    throw new ApiError(0, UNREACHABLE);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  // The server always sends { error } with its failures; a bare 5xx comes from a proxy that couldn't reach it
  if (res.status >= 500 && !data.error) throw new ApiError(0, UNREACHABLE);
  if (!res.ok) {
    const error = new ApiError(res.status, data.error ?? 'Something went wrong. Try again.', data.fields);
    reportApiError(error);
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  // Sends a file as the raw request body (image uploads)
  upload: <T>(path: string, file: Blob) => request<T>('POST', path, undefined, file),
};
