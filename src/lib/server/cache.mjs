import { createClient } from 'redis';

const state = globalThis.__wayfinderCache ||= { memory: new Map(), pending: new Map(), retryAt: 0 };
async function redis() {
  if (state.client?.isReady) return state.client;
  if (Date.now() < state.retryAt) return null;
  if (!state.connecting) {
    state.connecting = (async () => {
      const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379', socket: { connectTimeout: 800, reconnectStrategy: false } });
      client.on('error', () => {});
      try { await client.connect(); state.client = client; return client; }
      catch { state.retryAt = Date.now() + 30_000; return null; }
      finally { state.connecting = null; }
    })();
  }
  return state.connecting;
}

// Shared Redis cache plus a bounded per-process fallback and in-flight request coalescing.
export async function cached(key, ttlSeconds, fetcher) {
  const now = Date.now();
  const local = state.memory.get(key);
  if (local?.expires > now) return local.value;
  if (state.pending.has(key)) return state.pending.get(key);
  const work = (async () => {
    const client = await redis();
    let stored;
    try { stored = client ? await client.get(`wayfinder:${key}`) : null; } catch { /* bounded local fallback */ }
    if (stored) {
      const item = JSON.parse(stored);
      if (item.expires > now) { state.memory.set(key, item); return item.value; }
    }
    const value = await fetcher();
    const effectiveTtl = value?.unavailable ? Math.min(ttlSeconds,30) : Math.max(1,Math.min(ttlSeconds,value?.cacheTtlSeconds ?? ttlSeconds));
    const item = { value, expires: Date.now() + effectiveTtl * 1000 };
    if (state.memory.size >= 500) state.memory.delete(state.memory.keys().next().value);
    state.memory.set(key, item);
    try { if (client) await client.set(`wayfinder:${key}`, JSON.stringify(item), { EX: effectiveTtl }); } catch { /* keep local result */ }
    return value;
  })();
  state.pending.set(key, work);
  try { return await work; } finally { state.pending.delete(key); }
}
