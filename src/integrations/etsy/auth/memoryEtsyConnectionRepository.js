export function createMemoryEtsyConnectionRepository() {
  const connections = new Map();
  const locks = new Map();
  const repository = {
    async get(id) { return structuredClone(connections.get(id) ?? null); },
    async insert(connection) {
      connections.set(connection.connectionId, structuredClone(connection));
    },
    async save(connection) {
      if (!connections.has(connection.connectionId)) {
        throw new Error("ETSY_CONNECTION_NOT_FOUND");
      }
      connections.set(connection.connectionId, structuredClone(connection));
    },
    async withLock(id, callback) {
      const previous = locks.get(id) ?? Promise.resolve();
      let release;
      const current = new Promise(resolve => { release = resolve; });
      locks.set(id, current);
      await previous;
      try { return await callback(repository); }
      finally {
        release();
        if (locks.get(id) === current) locks.delete(id);
      }
    },
    count() { return connections.size; },
    clear() { connections.clear(); },
  };
  return repository;
}
