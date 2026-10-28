import test from "node:test";
import assert from "node:assert/strict";
import { analyze, calculateFeatures, distanceKm } from "../src/lib/engine";
import { emptyState, scenario } from "../src/lib/scenarios";
import {
  transactionSchema,
  type State,
  type TransactionInput,
} from "../src/lib/domain";
import { ingest, review, updateRule, createRule } from "../src/lib/service";
const now = "2026-10-04T06:00:00.000Z";
test("duplicate detection tolerates JSONB object key reordering", () => {
  const s = emptyState();
  const t = scenario("normal", now);
  const a = ingest(s, t);
  a.payload = Object.fromEntries(
    Object.entries(a.payload).reverse(),
  ) as TransactionInput;
  assert.equal(ingest(s, t).id, a.id);
});
test("velocity includes earlier stored attempts at the same timestamp", () => {
  const s = emptyState();
  s.transactions.push(analyze(scenario("normal", now), emptyState()));
  assert.equal(
    calculateFeatures(
      { ...scenario("normal", now), transaction_id: "same-time-next-attempt" },
      s,
    ).tx_count_5m,
    2,
  );
});
test("custom rules evaluate configured feature conditions and preserve versions", () => {
  const s = emptyState();
  createRule(s, {
    code: "CUSTOM_INTEGRITY",
    name: "Device integrity risk",
    description: "Detect elevated combined integrity flags",
    category: "DEVICE",
    enabled: true,
    weight: 45,
    threshold: 25,
    severity: "HIGH",
    condition: { feature: "device_risk_score", operator: "gte" },
  });
  const a = analyze({ ...scenario("normal", now), rooted_device: true }, s);
  assert.ok(a.triggered_rules.some((x) => x.code === "CUSTOM_INTEGRITY"));
  assert.equal(a.decision, "STEP_UP_AUTH");
  assert.throws(() => createRule(s, { code: "R017" }));
});
test("three advertised scenarios have deterministic decisions", () => {
  for (const [kind, decision] of [
    ["normal", "APPROVE"],
    ["suspicious", "STEP_UP_AUTH"],
    ["fraud", "REJECT_AND_FREEZE"],
  ] as const)
    assert.equal(analyze(scenario(kind, now), emptyState()).decision, decision);
});
const fixtures: Record<string, Partial<TransactionInput>> = {
  R001: { amount: 14000 },
  R002: { amount: 14800 },
  R003: { failed_pin_attempts: 3 },
  R004: { otp_resend_count: 3 },
  R005: { pin_reset_recently: true },
  R006: { device_is_new: true },
  R007: { device_is_new: true, amount: 20000, balance_before: 25000 },
  R008: { rooted_device: true },
  R009: { emulator_detected: true },
  R010: { vpn_active: true },
  R011: {},
  R012: { last_received_at: "2026-10-04T05:59:00.000Z" },
  R013: { channel_changed_recently: true },
  R014: { balance_inquiry_count_5m: 3 },
  R015: {
    previous_latitude: 22.3569,
    previous_longitude: 91.7832,
    previous_timestamp: "2026-10-04T05:55:00.000Z",
  },
  R016: {},
  R017: { device_id: "device-blacklisted" },
  R018: { agent_id: "agent-blacklisted" },
};
for (const [code, patch] of Object.entries(fixtures))
  test(`${code} triggers independently and respects disable`, () => {
    const s = emptyState();
    s.rules.forEach((r) => (r.enabled = r.code === code));
    const t = { ...scenario("normal", now), ...patch };
    if (code === "R011")
      for (let i = 0; i < 5; i++)
        s.transactions.push(
          analyze(
            {
              ...scenario(
                "normal",
                new Date(Date.parse(now) - (i + 1) * 1000).toISOString(),
              ),
              user_id: t.user_id,
            },
            emptyState(),
          ),
        );
    if (code === "R016")
      for (let i = 0; i < 3; i++)
        s.transactions.push({
          ...analyze(
            {
              ...scenario(
                "normal",
                new Date(Date.parse(now) - (i + 1) * 1000).toISOString(),
              ),
              receiver_id: t.receiver_id,
              user_id: `sender-${i}`,
            },
            emptyState(),
          ),
          decision: "REJECT_AND_FREEZE",
        });
    assert.deepEqual(
      analyze(t, s).triggered_rules.map((r) => r.code),
      [code],
    );
    s.rules.forEach((r) => (r.enabled = false));
    assert.equal(analyze(t, s).risk_score, 0);
  });
test("score bands, cap, and blacklist override zero configured weight", () => {
  const s = emptyState();
  for (const score of [0, 44, 45, 69, 70, 84, 85, 100]) {
    s.rules.forEach((r) => (r.enabled = r.code === "R005"));
    s.rules.find((r) => r.code === "R005")!.weight = score;
    const a = analyze(
      { ...scenario("normal", now), pin_reset_recently: true },
      s,
    );
    assert.equal(
      a.decision,
      score < 45
        ? "APPROVE"
        : score < 85
          ? "STEP_UP_AUTH"
          : "REJECT_AND_FREEZE",
    );
  }
  assert.equal(analyze(scenario("fraud", now), emptyState()).risk_score, 100);
  const b = emptyState();
  b.rules.find((r) => r.code === "R017")!.weight = 0;
  assert.equal(
    analyze({ ...scenario("normal", now), device_id: "device-blacklisted" }, b)
      .decision,
    "REJECT_AND_FREEZE",
  );
});
test("history windows exclude future transactions and calculate velocity with current attempt", () => {
  const s = emptyState();
  for (const seconds of [-10, 60, 301, 901, 3601, 86401])
    s.transactions.push(
      analyze(
        {
          ...scenario(
            "normal",
            new Date(Date.parse(now) - seconds * 1000).toISOString(),
          ),
          user_id: "demo-normal",
        },
        emptyState(),
      ),
    );
  const f = calculateFeatures(scenario("normal", now), s);
  assert.equal(f.tx_count_5m, 2);
  assert.equal(f.tx_count_15m, 3);
  assert.equal(f.tx_count_1h, 4);
  assert.equal(f.tx_count_24h, 5);
  assert.equal(f.amount_sum_5m, 2000);
});
test("cash-in never produces depletion or rapid outbound signals", () => {
  const t = {
    ...scenario("fraud", now),
    transaction_type: "CASH_IN" as const,
    last_received_at: "2026-10-04T05:59:00.000Z",
  };
  const a = analyze(t, emptyState());
  assert.equal(a.features.depletion_ratio, 0);
  assert.ok(
    !a.triggered_rules.some((r) =>
      ["R001", "R002", "R007", "R012"].includes(r.code),
    ),
  );
});
test("missing geolocation is safe and haversine measures Dhaka to Chattogram", () => {
  assert.equal(
    analyze(
      { ...scenario("normal", now), latitude: null, longitude: null },
      emptyState(),
    ).features.impossible_travel_speed,
    null,
  );
  assert.ok(distanceKm(23.8103, 90.4125, 22.3569, 91.7832) > 200);
});
test("validation rejects overspending, unknown fields, bad coordinates, and future context", () => {
  for (const patch of [
    { amount: 20000 },
    { latitude: 91 },
    { latitude: null },
    { failed_pin_attempts: -1 },
    { unknown: true },
    { previous_timestamp: "2026-10-05T00:00:00Z" },
  ])
    assert.equal(
      transactionSchema.safeParse({ ...scenario("normal", now), ...patch })
        .success,
      false,
    );
});
test("idempotent requests create no duplicate transactions or cases", () => {
  const s = emptyState();
  const t = scenario("fraud", now);
  const a = ingest(s, t);
  assert.equal(ingest(s, t).id, a.id);
  assert.equal(s.transactions.length, 1);
  assert.equal(s.cases.length, 1);
  assert.throws(() => ingest(s, { ...t, amount: 48000 }));
});
test("rule edits preserve past evidence and case reviews capture labels and notes", () => {
  const s = emptyState();
  const a = ingest(s, scenario("fraud", now));
  const prior = a.rule_snapshot.find((r) => r.code === "R015")!.weight;
  updateRule(s, "R015", { weight: 5 });
  assert.equal(a.rule_snapshot.find((r) => r.code === "R015")!.weight, prior);
  const c = review(s, s.cases[0].id, {
    action: "CONFIRM_FRAUD",
    note: "Verified synthetic fraud pattern",
  });
  assert.equal(c.status, "CONFIRMED_FRAUD");
  assert.equal(c.actions.length, 1);
  assert.ok(s.audit.some((x) => x.action === "CASE_REVIEWED"));
});
