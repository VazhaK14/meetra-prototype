import { Pool, type PoolClient } from "pg";

const database = globalThis as typeof globalThis & { meetraPool?: Pool };

export function db() {
  if (!database.meetraPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL belum disiapkan.");
    database.meetraPool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000 });
    database.meetraPool.on("error", () => console.error("Koneksi idle PostgreSQL terputus."));
  }
  return database.meetraPool;
}

export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
