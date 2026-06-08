import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export async function cached<T>(key: string, factory: () => Promise<T>, ttl = 60): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await factory();
  cache.set(key, value, ttl);
  return value;
}
