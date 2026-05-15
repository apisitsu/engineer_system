'use strict';

const TTL = {
  TOOLING: 5  * 60 * 1000,  // 5 min — formula + inventory changes propagate fast
  SDS:     10 * 60 * 1000,  // 10 min — external DB, we never write to it
};

class CacheAgent {
  constructor() {
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key) {
    this._store.delete(key);
  }

  // Removes all keys that start with a given prefix
  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }

  size()  { return this._store.size; }
  keys()  { return [...this._store.keys()]; }
}

const instance  = new CacheAgent();
instance.TTL    = TTL;
module.exports  = instance;
