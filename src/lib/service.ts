import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  transactionSchema,
  statuses,
  type State,
  type Analysis,
} from "./domain";
import { analyze } from "./engine";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function audit(
  s: State,
  action: string,
  id: string,
  details: unknown,
  actor = "analyst",
) {
  s.audit.push({
    id: randomUUID(),
    action,
    entity_id: id,
    details,
    actor,
    timestamp: new Date().toISOString(),
  });
}
export function ingest(s: State, body: unknown): Analysis {
  const payload = transactionSchema.parse(body);
  const existing = s.transactions.find(
    (x) => x.payload.transaction_id === payload.transaction_id,
  );
  if (existing) {
    if (!isDeepStrictEqual(existing.payload, payload))
      throw new HttpError(
        409,
        "Transaction ID already exists with a different payload",
      );
    return existing;
  }
  const a = analyze(payload, s);
  s.transactions.push(a);
  if (a.decision !== "APPROVE")
    s.cases.push({
      id: `case-${a.id}`,
      transaction_id: a.id,
      status: "NEW",
      actions: [],
      created_at: a.created_at,
    });
  audit(
    s,
    "TRANSACTION_ANALYZED",
    a.id,
    { risk_score: a.risk_score, decision: a.decision },
    "engine",
  );
  return a;
}
export const reviewSchema = z
  .object({
    action: z.enum([
      "CONFIRM_FRAUD",
      "MARK_FALSE_POSITIVE",
      "REQUEST_VERIFICATION",
      "RELEASE_HOLD",
      "KEEP_FROZEN",
    ]),
    note: z.string().trim().min(5).max(2000),
  })
  .strict();
export function review(s: State, id: string, body: unknown) {
  const input = reviewSchema.parse(body);
  const c = s.cases.find((x) => x.id === id);
  if (!c) throw new HttpError(404, "Case not found");
  c.status =
    input.action === "CONFIRM_FRAUD"
      ? "CONFIRMED_FRAUD"
      : input.action === "MARK_FALSE_POSITIVE"
        ? "FALSE_POSITIVE"
        : input.action === "RELEASE_HOLD"
          ? "CLOSED"
          : "UNDER_REVIEW";
  c.actions.push({
    ...input,
    actor: "analyst",
    timestamp: new Date().toISOString(),
  });
  audit(s, "CASE_REVIEWED", c.id, input);
  return c;
}
export const rulePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    weight: z.number().int().min(0).max(100).optional(),
    threshold: z.number().finite().min(0).max(10000000).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one change");
export const ruleCreateSchema = z
  .object({
    code: z.string().regex(/^CUSTOM_[A-Z0-9_]{1,40}$/),
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().min(5).max(500),
    category: z.enum([
      "LIQUIDITY",
      "CREDENTIAL",
      "DEVICE",
      "BEHAVIOR",
      "LOCATION",
      "TOPOLOGY",
    ]),
    enabled: z.boolean().default(true),
    weight: z.number().int().min(0).max(100),
    threshold: z.number().finite().min(0).max(10000000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    condition: z
      .object({
        feature: z.enum([
          "depletion_ratio",
          "tx_count_5m",
          "amount_sum_1h",
          "recipient_risk_score",
          "device_risk_score",
          "user_behavior_score",
        ]),
        operator: z.enum(["gte", "gt", "lt"]),
      })
      .strict(),
  })
  .strict();
export function createRule(s: State, body: unknown) {
  const input = ruleCreateSchema.parse(body);
  if (s.rules.some((r) => r.code === input.code))
    throw new HttpError(409, "Rule code already exists");
  const r = { ...input, version: 1, updated_at: new Date().toISOString() };
  s.rules.push(r);
  audit(s, "RULE_CREATED", r.code, r);
  return r;
}
export function updateRule(s: State, id: string, body: unknown) {
  const patch = rulePatchSchema.parse(body);
  const r = s.rules.find((x) => x.code === id);
  if (!r) throw new HttpError(404, "Rule not found");
  if (
    (id === "R001" || id === "R002") &&
    patch.threshold !== undefined &&
    patch.threshold > 1
  )
    throw new HttpError(400, "Depletion threshold must be between 0 and 1");
  const before = structuredClone(r);
  Object.assign(r, patch, {
    version: r.version + 1,
    updated_at: new Date().toISOString(),
  });
  audit(s, "RULE_UPDATED", id, { before, after: structuredClone(r) });
  return r;
}
export const alertPatchSchema = z.object({ status: z.enum(statuses) }).strict();
export function summary(s: State) {
  const tx = s.transactions;
  const distribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => ({
    level,
    count: tx.filter((x) => x.risk_level === level).length,
  }));
  const trend = Array.from({ length: 12 }, (_, i) => {
    const end = Date.now() - (11 - i) * 7200000;
    const start = end - 7200000;
    const items = tx.filter(
      (x) =>
        Date.parse(x.payload.timestamp) > start &&
        Date.parse(x.payload.timestamp) <= end,
    );
    return {
      timestamp: new Date(end).toISOString(),
      total: items.length,
      flagged: items.filter((x) => x.decision !== "APPROVE").length,
    };
  });
  return {
    total: tx.length,
    approved: tx.filter((x) => x.decision === "APPROVE").length,
    step_up: tx.filter((x) => x.decision === "STEP_UP_AUTH").length,
    rejected: tx.filter((x) => x.decision === "REJECT_AND_FREEZE").length,
    open_cases: s.cases.filter(
      (x) => x.status === "NEW" || x.status === "UNDER_REVIEW",
    ).length,
    screened_amount: tx.reduce((n, x) => n + x.payload.amount, 0),
    risk_distribution: distribution,
    trend,
    top_rules: s.rules
      .map((r) => ({
        code: r.code,
        name: r.name,
        count: tx.filter((x) =>
          x.triggered_rules.some((t) => t.code === r.code),
        ).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
export function profiles(
  s: State,
  kind: "users" | "devices" | "recipients" | "agents",
) {
  const field =
    kind === "users"
      ? "user_id"
      : kind === "devices"
        ? "device_id"
        : kind === "agents"
          ? "agent_id"
          : "receiver_id";
  return [
    ...new Set(s.transactions.map((x) => x.payload[field]).filter(Boolean)),
  ]
    .map((id) => {
      const tx = s.transactions.filter((x) => x.payload[field] === id);
      return {
        id,
        count: tx.length,
        amount: tx.reduce((n, x) => n + x.payload.amount, 0),
        max_risk: Math.max(...tx.map((x) => x.risk_score)),
        flagged: tx.filter((x) => x.decision !== "APPROVE").length,
        last_seen: tx.at(-1)?.payload.timestamp,
      };
    })
    .sort((a, b) => b.max_risk - a.max_risk);
}
