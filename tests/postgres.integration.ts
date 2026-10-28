import assert from "node:assert/strict";
import { migrate, withState, database } from "../src/lib/store";
import { ingest, review, updateRule } from "../src/lib/service";
import { scenario } from "../src/lib/scenarios";
if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "Set TEST_DATABASE_URL to an empty disposable PostgreSQL database.",
  );
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
try {
  await migrate();
  const count = await withState(false, (s) => s.transactions.length);
  if (count)
    throw new Error(
      "Integration test refused: database already has transactions. Use an empty disposable database.",
    );
  const t = scenario("fraud");
  t.transaction_id = "DB-TEST-" + crypto.randomUUID();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => withState(true, (s) => ingest(s, t))),
  );
  const a = results[0];
  assert.ok(results.every((x) => x.id === a.id));
  assert.equal(await withState(false, (s) => s.transactions.length), 1);
  const c = await withState(true, (s) =>
    review(s, s.cases[0].id, {
      action: "CONFIRM_FRAUD",
      note: "PostgreSQL integration verification",
    }),
  );
  await withState(true, (s) => updateRule(s, "R003", { weight: 17 }));
  const saved = await withState(false, (s) => s);
  assert.equal(
    saved.cases.find((x) => x.id === c.id)!.status,
    "CONFIRMED_FRAUD",
  );
  assert.equal(
    saved.transactions[0].rule_snapshot.find((x) => x.code === "R003")!.weight,
    15,
  );
  assert.equal(saved.rules.find((x) => x.code === "R003")!.weight, 17);
  const replay = await withState(true, (s) => ingest(s, t));
  assert.equal(replay.id, a.id);
  await assert.rejects(
    withState(true, (s) => {
      s.transactions.push({
        ...a,
        id: "rollback-probe",
        payload: { ...a.payload, transaction_id: "ROLLBACK" },
      });
      throw new Error("Intentional rollback");
    }),
  );
  assert.equal(
    await withState(false, (s) =>
      s.transactions.some((x) => x.id === "rollback-probe"),
    ),
    false,
  );
  console.log(
    "PostgreSQL integration checks passed. The disposable database contains synthetic test records.",
  );
} finally {
  await database().end();
}
