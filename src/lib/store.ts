import postgres from "postgres";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { State } from "./domain";
import { emptyState, seedState } from "./scenarios";
const globals = globalThis as unknown as {
  mfsSql?: ReturnType<typeof postgres>;
  mfsDemo?: State;
  mfsQueue?: Promise<unknown>;
};
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return (globals.mfsSql ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  }));
}
export function storageMode() {
  return process.env.DATABASE_URL
    ? "postgres"
    : process.env.VERCEL
      ? "ephemeral-demo"
      : "local-demo";
}
function guard() {
  if (
    process.env.VERCEL &&
    !process.env.DATABASE_URL &&
    process.env.DEMO_MODE !== "true"
  )
    throw new Error(
      "Configure DATABASE_URL or explicitly enable DEMO_MODE=true for synthetic demonstrations",
    );
}
const collections = ["transactions", "rules", "cases", "audit"] as const;
export async function migrate() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS mfs_meta (id text PRIMARY KEY, data jsonb NOT NULL)`;
  for (const name of collections)
    await sql`CREATE TABLE IF NOT EXISTS ${sql("mfs_" + name)} (id text PRIMARY KEY, data jsonb NOT NULL)`;
  await sql`INSERT INTO mfs_meta (id,data) VALUES ('config',${sql.json({ blacklisted_devices: ["device-blacklisted"], blacklisted_agents: ["agent-blacklisted"] })}) ON CONFLICT DO NOTHING`;
  for (const r of emptyState().rules)
    await sql`INSERT INTO mfs_rules (id,data) VALUES (${r.code},${sql.json(JSON.parse(JSON.stringify(r)))}) ON CONFLICT DO NOTHING`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mfs_transaction_external_id ON mfs_transactions ((data->'payload'->>'transaction_id'))`;
}
export async function withState<T>(
  mutate: boolean,
  fn: (s: State) => T | Promise<T>,
): Promise<T> {
  guard();
  if (process.env.DATABASE_URL) {
    const sql = database();
    return (await sql.begin(async (tx) => {
      // A database transaction lock makes history -> evaluation -> save atomic across serverless instances.
      if (mutate) await tx`SELECT pg_advisory_xact_lock(741923)`;
      const rows = await tx`SELECT data FROM mfs_meta WHERE id='config'`;
      if (!rows[0])
        throw new Error("Database schema is missing. Run npm run db:migrate.");
      const s = emptyState();
      Object.assign(s, rows[0].data);
      for (const name of collections) {
        const records = await tx`SELECT data FROM ${tx("mfs_" + name)}`;
        Object.assign(s, { [name]: records.map((r) => r.data) });
      }
      s.transactions.sort(
        (a, b) =>
          Date.parse(a.payload.timestamp) - Date.parse(b.payload.timestamp),
      );
      s.audit.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      const times = new Map(
        s.transactions.map((t) => [t.id, Date.parse(t.payload.timestamp)]),
      );
      s.cases.sort(
        (a, b) =>
          (times.get(a.transaction_id) ?? 0) -
          (times.get(b.transaction_id) ?? 0),
      );
      const before = new Map(
        collections.map((name) => [
          name,
          new Map(
            s[name].map((item) => [
              "code" in item ? item.code : item.id,
              JSON.stringify(item),
            ]),
          ),
        ]),
      );
      const result = await fn(s);
      if (mutate) {
        for (const name of collections)
          for (const item of s[name]) {
            const id = "code" in item ? item.code : item.id;
            if (before.get(name)?.get(id) !== JSON.stringify(item))
              await tx`INSERT INTO ${tx("mfs_" + name)} (id,data) VALUES (${id},${tx.json(JSON.parse(JSON.stringify(item)))}) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data`;
          }
      }
      return result;
    })) as T;
  }
  const work = async () => {
    let s: State;
    if (process.env.VERCEL)
      s = structuredClone((globals.mfsDemo ??= seedState()));
    else {
      try {
        s = JSON.parse(
          await readFile(join(process.cwd(), ".data/state.json"), "utf8"),
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        s = seedState();
        await mkdir(".data", { recursive: true });
        await writeFile(
          join(process.cwd(), ".data/state.json"),
          JSON.stringify(s),
        );
      }
    }
    const result = await fn(s);
    if (mutate) {
      if (process.env.VERCEL) globals.mfsDemo = s;
      else {
        await mkdir(".data", { recursive: true });
        const path = join(process.cwd(), ".data/state.json");
        await writeFile(path + ".tmp", JSON.stringify(s));
        await rename(path + ".tmp", path);
      }
    }
    return result;
  };
  const pending = (globals.mfsQueue ?? Promise.resolve()).then(work);
  globals.mfsQueue = pending.catch(() => {});
  return pending;
}
