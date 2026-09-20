import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// A separate server-side key, never the Etsy shared secret or a client variable.
export function createEtsyTokenCipher(keyHex) {
  if (typeof keyHex !== "string" || !/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error("ETSY_TOKEN_ENCRYPTION_KEY_INVALID");
  }
  const key = Buffer.from(keyHex, "hex");
  return {
    encrypt(connection) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from("etsy-connection:v1:" + connection.connectionId));
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(connection), "utf8"), cipher.final(),
      ]);
      return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"),
        ciphertext.toString("base64")].join(".");
    },
    decrypt(connectionId, payload) {
      try {
        const parts = payload.split(".");
        if (parts.length !== 4 || parts[0] !== "v1") throw new Error();
        const iv = Buffer.from(parts[1], "base64");
        const tag = Buffer.from(parts[2], "base64");
        if (iv.length !== 12 || tag.length !== 16) throw new Error();
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(Buffer.from("etsy-connection:v1:" + connectionId));
        decipher.setAuthTag(tag);
        const connection = JSON.parse(Buffer.concat([
          decipher.update(Buffer.from(parts[3], "base64")), decipher.final(),
        ]).toString("utf8"));
        if (connection.connectionId !== connectionId) throw new Error();
        return connection;
      } catch {
        // Never include ciphertext, tokens, or the key in errors.
        throw new Error("ETSY_TOKEN_DECRYPTION_FAILED");
      }
    },
  };
}
