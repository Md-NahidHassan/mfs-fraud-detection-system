import { transactionSchema, type TransactionInput, type State } from "./domain";
import { defaultRules } from "./rules";
import { analyze } from "./engine";
export function scenario(
  kind: "normal" | "suspicious" | "fraud",
  timestamp = new Date().toISOString(),
): TransactionInput {
  const time = Date.parse(timestamp);
  return transactionSchema.parse({
    transaction_id: `TX-${kind.toUpperCase()}-${time}`,
    user_id: `demo-${kind}`,
    amount: kind === "normal" ? 1000 : kind === "suspicious" ? 20000 : 49000,
    balance_before:
      kind === "normal" ? 15000 : kind === "suspicious" ? 25000 : 50000,
    transaction_type: kind === "fraud" ? "CASH_OUT" : "SEND_MONEY",
    timestamp,
    latitude: 23.8103,
    longitude: 90.4125,
    device_id: `device-${kind}`,
    receiver_id: `recipient-${kind}`,
    device_is_new: kind !== "normal",
    failed_pin_attempts: kind === "fraud" ? 4 : kind === "suspicious" ? 2 : 0,
    otp_resend_count: kind === "fraud" ? 5 : kind === "suspicious" ? 2 : 0,
    channel_changed_recently: kind === "suspicious",
    pin_reset_recently: kind === "fraud",
    vpn_active: kind === "fraud",
    ...(kind === "fraud"
      ? {
          previous_latitude: 22.3569,
          previous_longitude: 91.7832,
          previous_timestamp: new Date(time - 300000).toISOString(),
        }
      : {}),
  });
}
export function emptyState(): State {
  return {
    transactions: [],
    rules: defaultRules(),
    cases: [],
    audit: [],
    blacklisted_devices: ["device-blacklisted"],
    blacklisted_agents: ["agent-blacklisted"],
  };
}
export function seedState(): State {
  const s = emptyState();
  const now = Date.now();
  for (let i = 47; i >= 0; i--) {
    const kind = i % 13 === 0 ? "fraud" : i % 5 === 0 ? "suspicious" : "normal";
    const t = scenario(kind, new Date(now - i * 1800000).toISOString());
    t.transaction_id = `DEMO-${String(48 - i).padStart(4, "0")}`;
    t.user_id = `wallet-${String((i % 12) + 1).padStart(3, "0")}`;
    t.device_id = `device-${t.user_id}`;
    t.receiver_id = `recipient-${(i % 6) + 1}`;
    const a = analyze(t, s);
    s.transactions.push(a);
    if (a.decision !== "APPROVE")
      s.cases.push({
        id: `case-${a.id}`,
        transaction_id: a.id,
        status: "NEW",
        actions: [],
        created_at: a.created_at,
      });
  }
  s.audit.push({
    id: "seed",
    action: "DEMO_SEEDED",
    actor: "system",
    entity_id: "demo",
    timestamp: new Date().toISOString(),
    details: { synthetic: true, count: 48 },
  });
  return s;
}
