export function createMemoryEtsyConnectionRepository() {
  const connections = new Map();
  const locks = new Map();
  const repository = {
    async get(id) { return structuredClone(connections.get(id) ?? null); },
    async getByOwnerSessionHash(ownerSessionHash) {
      const connection = [...connections.values()].find(
        item => item.ownerSessionHash === ownerSessionHash,
      );
      return structuredClone(connection ?? null);
    },
    async insert(connection) {
      connections.set(connection.connectionId, structuredClone(connection));
    },
    async removeByOwnerSessionHash(ownerSessionHash) {
      for (const [id, connection] of connections) {
        if (connection.ownerSessionHash === ownerSessionHash) connections.delete(id);
      }
    },
    async save(connection) {
      if (!connections.has(connection.connectionId)) {
        throw new Error("ETSY_CONNECTION_NOT_FOUND");
      }
      connections.set(connection.connectionId, structuredClone(connection));
    },
    async withOwnerLock(ownerSessionHash, callback) {
      return repository.withLock("owner:" + ownerSessionHash, async () => {
        const existing = await repository.getByOwnerSessionHash(ownerSessionHash);
        return existing
          ? repository.withLock(existing.connectionId, callback)
          : callback(repository);
      });
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
