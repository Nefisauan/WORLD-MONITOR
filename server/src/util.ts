/** Provider errors intentionally omit path, query, userinfo and raw exception text. */
class ProviderRequestError extends Error {}

export function providerError(url: string, status?: number): Error {
  let host = "unknown provider";
  try { host = new URL(url).hostname; } catch { /* No raw URL in errors. */ }
  return new ProviderRequestError(`${status == null ? "Request failed" : `HTTP ${status}`} from ${host}`);
}

// Small utilities: fetch with timeout/retry, concurrency pool, stats helpers.

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; retries?: number } = {},
): Promise<T> {
  const { timeoutMs = 12_000, headers = {}, retries = 1 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "world-intel/0.1 (research terminal)", ...headers },
        signal: ctrl.signal,
      });
      if (!res.ok) throw providerError(url, res.status);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err instanceof ProviderRequestError ? err : providerError(url);
      if (attempt < retries) await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const { timeoutMs = 12_000, headers = {} } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "world-intel/0.1 (research terminal)", ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) throw providerError(url, res.status);
    return await res.text();
  } catch (err) {
    throw err instanceof ProviderRequestError ? err : providerError(url);
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Run tasks with bounded concurrency; failures resolve to null. */
export async function pool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch {
        results[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Downsample an array to at most n points, preserving first/last. */
export function downsample(xs: number[], n: number): number[] {
  if (xs.length <= n) return xs;
  const out: number[] = [];
  const step = (xs.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(xs[Math.round(i * step)]);
  return out;
}

export function pctChange(from: number, to: number): number | null {
  if (!isFinite(from) || !isFinite(to) || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

const STOPWORDS = new Set(
  "a an the of to in on for and or as at by with from is are was were be been it its this that after amid over under new says said say could would will".split(
    " ",
  ),
);

export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}
