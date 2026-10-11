import { ApiError } from './api';

// Outcome of a save/delete: ok with the server's response, or a message (and field errors) to show
export type Saved<T = unknown> = { ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> };

export async function attempt<T>(run: () => Promise<T>, fallback: string): Promise<Saved<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (e) {
    if (!(e instanceof ApiError)) return { ok: false, error: fallback };
    return { ok: false, error: e.message, fields: e.fields };
  }
}

// Loads data for a page; failures become a message instead of a crash
export async function load<T>(run: () => Promise<T>, fallback: string): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await run() };
  } catch (e) {
    return { error: e instanceof ApiError && e.status !== 500 ? e.message : fallback };
  }
}
