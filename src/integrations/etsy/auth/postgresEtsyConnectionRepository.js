export function createPostgresEtsyConnectionRepository({ pool, cipher }) {
  async function query(client, ...args) {
    try { return await client.query(...args); }
    catch { throw new Error("ETSY_CONNECTION_STORAGE_UNAVAILABLE"); }
  }
  function queries(client) {
    return {
      async get(id) {
        const { rows } = await query(client,
          "SELECT payload FROM etsy_connections WHERE connection_id = $1", [id],
        );
        return rows.length ? cipher.decrypt(id, rows[0].payload) : null;
      },
      async getByOwnerSessionHash(ownerSessionHash) {
        const { rows } = await query(client,
          "SELECT connection_id, payload FROM etsy_connections WHERE owner_session_hash = $1",
          [ownerSessionHash],
        );
        if (!rows.length) return null;
        const connection = cipher.decrypt(rows[0].connection_id, rows[0].payload);
        // The searchable owner column must match the authenticated ciphertext.
        if (connection.ownerSessionHash !== ownerSessionHash) {
          throw new Error("ETSY_CONNECTION_OWNER_MISMATCH");
        }
        return connection;
      },
      async insert(connection) {
        await query(client,
          "INSERT INTO etsy_connections (connection_id, owner_session_hash, payload) VALUES ($1, $2, $3)",
          [connection.connectionId, connection.ownerSessionHash, cipher.encrypt(connection)],
        );
      },
      async save(connection) {
        const result = await query(client,
          "UPDATE etsy_connections SET payload = $2 WHERE connection_id = $1",
          [connection.connectionId, cipher.encrypt(connection)],
        );
        if (result.rowCount !== 1) throw new Error("ETSY_CONNECTION_NOT_FOUND");
      },
    };
  }
  return {
    ...queries(pool),
    async withOwnerLock(ownerSessionHash, callback) {
      return transaction(async client => {
        // Also serializes first connections, where there is no row to lock yet.
        await query(client, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerSessionHash]);
        // Share the row lock used by token refresh before replacing credentials.
        await query(client,
          "SELECT connection_id FROM etsy_connections WHERE owner_session_hash = $1 FOR UPDATE",
          [ownerSessionHash],
        );
        return callback(queries(client));
      });
    },
    async withLock(id, callback) {
      return transaction(async client => {
        await query(client,
          "SELECT connection_id FROM etsy_connections WHERE connection_id = $1 FOR UPDATE",
          [id],
        );
        return callback(queries(client));
      });
    },
  };

  async function transaction(callback) {
    let client;
    try { client = await pool.connect(); }
    catch { throw new Error("ETSY_CONNECTION_STORAGE_UNAVAILABLE"); }
    try {
      await query(client, "BEGIN");
      await query(client, "SET LOCAL lock_timeout = '15s'");
      const result = await callback(client);
      await query(client, "COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* release below */ }
      throw error;
    } finally {
      client.release();
    }
  }
}
