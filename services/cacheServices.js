// /services/cacheService.js
const cache = new Map();

export const setCache = (key, value) => cache.set(key, { value, timestamp: Date.now() });

export const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  const isExpired = Date.now() - entry.timestamp > 5 * 60 * 1000; // 5 min
  return isExpired ? null : entry.value;
};
