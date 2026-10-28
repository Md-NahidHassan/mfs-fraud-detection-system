import { z } from "zod";
const money = z.number().finite().min(0).max(10000000);
const identifier = z.string().trim().min(1).max(100);
export const transactionSchema = z
  .object({
    transaction_id: identifier,
    user_id: identifier,
    msisdn: z
      .string()
      .regex(/^01[3-9]\d{8}$/)
      .default("01712345678"),
    transaction_type: z.enum(["SEND_MONEY", "CASH_OUT", "PAYMENT", "CASH_IN"]),
    amount: money.refine((n) => n > 0, "Amount must be positive"),
    fee: money.default(0),
    balance_before: money,
    receiver_id: identifier.default("recipient-001"),
    agent_id: z.string().max(100).default(""),
    channel: z.enum(["APP", "USSD", "AGENT"]).default("APP"),
    device_id: identifier.default("device-001"),
    imei: z.string().max(30).default(""),
    sim_id: z.string().max(100).default(""),
    ip_address: z.string().max(100).default(""),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    timestamp: z.iso.datetime({ offset: true }),
    failed_pin_attempts: z.number().int().min(0).max(100).default(0),
    otp_resend_count: z.number().int().min(0).max(100).default(0),
    balance_inquiry_count_5m: z.number().int().min(0).max(100).default(0),
    pin_reset_recently: z.boolean().default(false),
    device_is_new: z.boolean().default(false),
    rooted_device: z.boolean().default(false),
    emulator_detected: z.boolean().default(false),
    vpn_active: z.boolean().default(false),
    screen_share_detected: z.boolean().default(false),
    channel_changed_recently: z.boolean().default(false),
    previous_latitude: z.number().min(-90).max(90).nullable().default(null),
    previous_longitude: z.number().min(-180).max(180).nullable().default(null),
    previous_timestamp: z.iso
      .datetime({ offset: true })
      .nullable()
      .default(null),
    last_received_at: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.transaction_type !== "CASH_IN" && t.amount + t.fee > t.balance_before)
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Amount and fee exceed available balance",
      });
    for (const [a, b] of [
      ["latitude", "longitude"],
      ["previous_latitude", "previous_longitude"],
    ] as const)
      if ((t[a] === null) !== (t[b] === null))
        ctx.addIssue({
          code: "custom",
          path: [a],
          message: "Provide both location coordinates or neither",
        });
    for (const key of ["previous_timestamp", "last_received_at"] as const)
      if (t[key] && Date.parse(t[key]!) > Date.parse(t.timestamp))
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Context timestamp cannot be later than the transaction",
        });
  });
export type TransactionInput = z.infer<typeof transactionSchema>;
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Decision = "APPROVE" | "STEP_UP_AUTH" | "REJECT_AND_FREEZE";
export interface Rule {
  code: string;
  name: string;
  category: string;
  enabled: boolean;
  weight: number;
  threshold: number;
  severity: RiskLevel;
  version: number;
  updated_at: string;
  description: string;
  condition?: {
    feature:
      | "depletion_ratio"
      | "tx_count_5m"
      | "amount_sum_1h"
      | "recipient_risk_score"
      | "device_risk_score"
      | "user_behavior_score";
    operator: "gte" | "gt" | "lt";
  };
}
export interface Features {
  depletion_ratio: number;
  turnaround_latency_seconds: number | null;
  tx_count_5m: number;
  tx_count_15m: number;
  tx_count_1h: number;
  tx_count_24h: number;
  amount_sum_5m: number;
  amount_sum_1h: number;
  impossible_travel_speed: number | null;
  recipient_risk_score: number;
  device_risk_score: number;
  user_behavior_score: number;
  device_is_new: boolean;
  channel_hop: boolean;
  outgoing: boolean;
}
export interface Trigger {
  code: string;
  name: string;
  weight: number;
  severity: RiskLevel;
  reason: string;
  version: number;
}
export interface Analysis {
  id: string;
  payload: TransactionInput;
  features: Features;
  triggered_rules: Trigger[];
  rule_snapshot: Rule[];
  risk_score: number;
  risk_level: RiskLevel;
  decision: Decision;
  balance_after: number;
  created_at: string;
}
export const statuses = [
  "NEW",
  "UNDER_REVIEW",
  "CONFIRMED_FRAUD",
  "FALSE_POSITIVE",
  "CLOSED",
] as const;
export type Status = (typeof statuses)[number];
export interface Case {
  id: string;
  transaction_id: string;
  status: Status;
  actions: { action: string; note: string; actor: string; timestamp: string }[];
  created_at: string;
}
export interface Audit {
  id: string;
  action: string;
  actor: string;
  entity_id: string;
  timestamp: string;
  details: unknown;
}
export interface State {
  transactions: Analysis[];
  rules: Rule[];
  cases: Case[];
  audit: Audit[];
  blacklisted_devices: string[];
  blacklisted_agents: string[];
}
