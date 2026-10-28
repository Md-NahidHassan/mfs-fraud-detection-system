import { randomUUID } from "node:crypto";
import type {
  Analysis,
  Features,
  State,
  TransactionInput,
  Trigger,
} from "./domain";
export function distanceKm(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function calculateFeatures(t: TransactionInput, s: State): Features {
  const now = Date.parse(t.timestamp);
  const history = s.transactions
    .filter(
      (x) =>
        x.payload.user_id === t.user_id &&
        Date.parse(x.payload.timestamp) <= now,
    )
    .sort(
      (a, b) =>
        Date.parse(b.payload.timestamp) - Date.parse(a.payload.timestamp),
    );
  const window = (sec: number) =>
    history.filter((x) => now - Date.parse(x.payload.timestamp) <= sec * 1000);
  const previous = history[0]?.payload;
  const located = history.find(
    (x) => x.payload.latitude !== null && x.payload.longitude !== null,
  )?.payload;
  const prevLat = t.previous_latitude ?? located?.latitude;
  const prevLon = t.previous_longitude ?? located?.longitude;
  const prevTime = t.previous_timestamp ?? located?.timestamp;
  let speed: number | null = null;
  if (
    t.latitude !== null &&
    t.longitude !== null &&
    prevLat != null &&
    prevLon != null &&
    prevTime
  ) {
    const hours = (now - Date.parse(prevTime)) / 3600000;
    const distance = distanceKm(prevLat, prevLon, t.latitude, t.longitude);
    if (hours > 0) speed = distance / hours;
    else if (hours === 0 && distance > 1) speed = 1000000;
  }
  const inbound = history.find((x) => x.payload.transaction_type === "CASH_IN");
  const received = t.last_received_at ?? inbound?.payload.timestamp;
  const recipient = s.transactions.filter(
    (x) =>
      x.payload.receiver_id === t.receiver_id &&
      x.payload.transaction_type !== "CASH_IN" &&
      Date.parse(x.payload.timestamp) <= now &&
      now - Date.parse(x.payload.timestamp) <= 86400000,
  );
  const senders = new Set(recipient.map((x) => x.payload.user_id));
  senders.add(t.user_id);
  const recipientRisk = Math.min(
    100,
    (senders.size >= 5 ? 50 : 0) +
      recipient.filter((x) => x.decision === "REJECT_AND_FREEZE").length * 25,
  );
  const newDevice =
    t.device_is_new ||
    (!!previous &&
      !history.some(
        (x) =>
          x.payload.device_id === t.device_id &&
          (!t.imei || x.payload.imei === t.imei),
      ));
  const outgoing = t.transaction_type !== "CASH_IN";
  const sum = (sec: number) =>
    window(sec)
      .filter((x) => x.payload.transaction_type !== "CASH_IN")
      .reduce((n, x) => n + x.payload.amount, 0) + (outgoing ? t.amount : 0);
  return {
    outgoing,
    depletion_ratio:
      outgoing && t.balance_before > 0
        ? (t.amount + t.fee) / t.balance_before
        : 0,
    turnaround_latency_seconds: received
      ? Math.max(0, (now - Date.parse(received)) / 1000)
      : null,
    tx_count_5m: window(300).length + 1,
    tx_count_15m: window(900).length + 1,
    tx_count_1h: window(3600).length + 1,
    tx_count_24h: window(86400).length + 1,
    amount_sum_5m: sum(300),
    amount_sum_1h: sum(3600),
    impossible_travel_speed: speed,
    recipient_risk_score: recipientRisk,
    device_risk_score: Math.min(
      100,
      (newDevice ? 25 : 0) +
        (t.rooted_device ? 25 : 0) +
        (t.emulator_detected ? 30 : 0) +
        (t.screen_share_detected ? 20 : 0),
    ),
    user_behavior_score: Math.min(
      100,
      t.failed_pin_attempts * 10 + t.otp_resend_count * 5,
    ),
    device_is_new: newDevice,
    channel_hop:
      t.channel_changed_recently ||
      (!!previous &&
        previous.channel !== t.channel &&
        now - Date.parse(previous.timestamp) <= 300000),
  };
}
export function analyze(t: TransactionInput, s: State): Analysis {
  const f = calculateFeatures(t, s);
  const triggered: Trigger[] = [];
  for (const r of s.rules.filter((r) => r.enabled)) {
    let hit = false;
    let reason = r.description;
    switch (r.code) {
      case "R001":
      case "R002":
        hit = f.outgoing && f.depletion_ratio >= r.threshold;
        reason = `${(f.depletion_ratio * 100).toFixed(1)}% balance depletion; threshold ${(r.threshold * 100).toFixed(1)}%.`;
        break;
      case "R003":
        hit = t.failed_pin_attempts >= r.threshold;
        reason = `${t.failed_pin_attempts} failed PIN attempts; threshold ${r.threshold}.`;
        break;
      case "R004":
        hit = t.otp_resend_count >= r.threshold;
        reason = `${t.otp_resend_count} OTP resends; threshold ${r.threshold}.`;
        break;
      case "R005":
        hit = t.pin_reset_recently;
        break;
      case "R006":
        hit = f.device_is_new;
        break;
      case "R007":
        hit = f.outgoing && f.device_is_new && t.amount >= r.threshold;
        break;
      case "R008":
        hit = t.rooted_device;
        break;
      case "R009":
        hit = t.emulator_detected;
        break;
      case "R010":
        hit = t.vpn_active;
        break;
      case "R011":
        hit = f.tx_count_5m > r.threshold;
        reason = `${f.tx_count_5m} attempts within five minutes; threshold > ${r.threshold}.`;
        break;
      case "R012":
        hit =
          f.outgoing &&
          f.turnaround_latency_seconds !== null &&
          f.turnaround_latency_seconds < r.threshold;
        reason = `${f.turnaround_latency_seconds ?? "Unknown"} seconds since received funds; threshold < ${r.threshold}.`;
        break;
      case "R013": {
        const previous = s.transactions
          .filter(
            (x) =>
              x.payload.user_id === t.user_id &&
              Date.parse(x.payload.timestamp) < Date.parse(t.timestamp),
          )
          .sort(
            (a, b) =>
              Date.parse(b.payload.timestamp) - Date.parse(a.payload.timestamp),
          )[0];
        hit =
          t.channel_changed_recently ||
          (!!previous &&
            previous.payload.channel !== t.channel &&
            Date.parse(t.timestamp) - Date.parse(previous.payload.timestamp) <=
              r.threshold * 1000);
        break;
      }
      case "R014":
        hit = f.outgoing && t.balance_inquiry_count_5m >= r.threshold;
        break;
      case "R015":
        hit =
          f.impossible_travel_speed !== null &&
          f.impossible_travel_speed > r.threshold;
        reason = `${f.impossible_travel_speed?.toFixed(0) ?? "Unknown"} km/h implied travel; threshold > ${r.threshold} km/h.`;
        break;
      case "R016":
        hit = f.outgoing && f.recipient_risk_score >= r.threshold;
        reason = `Recipient risk ${f.recipient_risk_score}/100; threshold ${r.threshold}.`;
        break;
      case "R017":
        hit = s.blacklisted_devices.includes(t.device_id);
        break;
      case "R018":
        hit = !!t.agent_id && s.blacklisted_agents.includes(t.agent_id);
        break;
    }
    if (r.condition) {
      const value = f[r.condition.feature];
      hit =
        r.condition.operator === "gte"
          ? value >= r.threshold
          : r.condition.operator === "gt"
            ? value > r.threshold
            : value < r.threshold;
      reason = `${r.condition.feature}: ${value}; condition ${r.condition.operator} ${r.threshold}.`;
    }
    if (hit)
      triggered.push({
        code: r.code,
        name: r.name,
        weight: r.weight,
        severity: r.severity,
        reason,
        version: r.version,
      });
  }
  const hard = triggered.some((r) => r.code === "R017" || r.code === "R018");
  const score = hard
    ? 100
    : Math.min(
        100,
        triggered.reduce((n, r) => n + r.weight, 0),
      );
  return {
    id: randomUUID(),
    payload: t,
    features: f,
    triggered_rules: triggered,
    rule_snapshot: structuredClone(s.rules),
    risk_score: score,
    risk_level:
      score >= 85
        ? "CRITICAL"
        : score >= 70
          ? "HIGH"
          : score >= 45
            ? "MEDIUM"
            : "LOW",
    decision:
      hard || score >= 85
        ? "REJECT_AND_FREEZE"
        : score >= 45
          ? "STEP_UP_AUTH"
          : "APPROVE",
    balance_after:
      t.transaction_type === "CASH_IN"
        ? t.balance_before + t.amount - t.fee
        : t.balance_before - t.amount - t.fee,
    created_at: new Date().toISOString(),
  };
}
