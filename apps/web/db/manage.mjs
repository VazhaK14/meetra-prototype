import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import pg from "pg";

try {
  loadEnvFile(new URL("../.env.local", import.meta.url));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const task = process.argv[2];
if (!process.env.DATABASE_URL || !["migrate", "seed"].includes(task)) {
  console.error("Isi DATABASE_URL dan jalankan db:migrate atau db:seed.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(27192601)");
  if (task === "migrate") {
    await client.query("CREATE TABLE IF NOT EXISTS meetra_migrations (version text PRIMARY KEY)");
    const version = "001-initial";
    const found = await client.query("SELECT 1 FROM meetra_migrations WHERE version = $1", [version]);
    if (!found.rowCount) {
      await client.query(await readFile(new URL("./001-initial.sql", import.meta.url), "utf8"));
      await client.query("INSERT INTO meetra_migrations VALUES ($1)", [version]);
    }
  } else {
    const { people, pods } = JSON.parse(await readFile(new URL("./fixtures.json", import.meta.url), "utf8"));
    for (const person of people) {
      await client.query(`
        INSERT INTO accounts (id, username, dummy_profile, onboarding_step) VALUES ($1, $2, $3, 4)
        ON CONFLICT (id) DO UPDATE SET dummy_profile = EXCLUDED.dummy_profile
        WHERE accounts.dummy_profile IS NOT NULL
      `, [person.id, `dummy-${person.id}`, person]);
    }

    for (const { id, title, topic, schedule, mentor, mentee } of pods) {
      await client.query(`
        INSERT INTO pods (id, title, topic, goal, schedule) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, topic = EXCLUDED.topic,
          goal = EXCLUDED.goal, schedule = EXCLUDED.schedule
        WHERE pods.owner_id IS NULL
      `, [id, title, topic, `Berlatih ${topic} bersama anggota Pod.`, schedule]);
      for (const [account, role] of [[mentor, "Mentor"], [mentee, "Mentee"]]) {
        await client.query(`
          INSERT INTO pod_members (pod_id, account_id, role) VALUES ($1, $2, $3)
          ON CONFLICT (pod_id, account_id) DO UPDATE SET role = EXCLUDED.role
        `, [id, account, role]);
      }
    }
  }
  await client.query("COMMIT");
  console.log(task === "migrate" ? "Migrasi Meetra siap." : "Data dummy Meetra siap.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
