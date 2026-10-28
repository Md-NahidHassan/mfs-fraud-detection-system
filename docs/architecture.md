# Architecture

The supplied Python/FastAPI and separate React stack has been replaced, as requested, with a single TypeScript/Next.js application suitable for Vercel.

```text
Operations UI -> Next.js route handlers -> validation -> feature engine
              -> configured rule engine -> score / decision
              -> transaction + case + audit persistence
```

The API runs in the Node.js runtime. The pure feature and rule engines are in `src/lib/engine.ts`; validation and domain types are in `domain.ts`; transaction, rule, and review workflows are in `service.ts`.

## Persistence

PostgreSQL stores separate transaction, rule, case, audit, and configuration collections in `mfs_transactions`, `mfs_rules`, `mfs_cases`, `mfs_audit`, and `mfs_meta`. Each record has a primary key and a JSONB document. An expression index enforces unique external transaction IDs. Transaction documents contain immutable payloads, derived features, triggered rules, the complete rule configuration snapshot, scores, and decisions. Cases contain review actions; audits record transaction analysis and all rule/review mutations.

This consolidates the plan's proposed normalized tables for the prototype. User, recipient, agent, and device histories are derived from transactions rather than separately maintained profiles. This avoids inconsistent profile counts while preserving the Phase 1 workflows. At larger scale, normalize hot fields, add indexes and paginated queries, and use dedicated entity/profile tables.

Every database mutation obtains a PostgreSQL advisory transaction lock before loading history and policy. Evaluation and persistence therefore complete atomically across serverless instances. Duplicate transaction IDs with equivalent payloads return the original result; changed payloads return HTTP 409. Failed writes roll back. Rule updates affect future decisions only.

For the prototype, requests load the stored collections into memory and evaluate history there. This supports demonstrations and small datasets, not high-volume payment processing. Production ingestion needs indexed time-window queries, retention, per-account concurrency, durable rate limits, and actual integration with payment authorization.

Local demo state is saved atomically in `.data/state.json` with an in-process mutation queue. It is for one development server. Explicit Vercel demo mode keeps ephemeral state in memory. PostgreSQL mode never falls back to demo data if the database fails.

## Scoring and signal definitions

- Rule weights add and cap at 100. The high and critical depletion rules both contribute when both thresholds match, following the plan's additive scoring.
- Low: 0–44; medium: 45–69; high: 70–84; critical: 85–100.
- Approve below 45; require step-up authentication from 45 through 84; reject and recommend freeze at 85 or above.
- Enabled device/agent blocklist rules always reject, even if their weight is changed to zero. Disabling those rules explicitly disables the control and is audited.
- Velocity includes the current attempt and prior recorded attempts within each window. Future-dated history is excluded.
- Turnaround uses a supplied last-received timestamp or the latest recorded cash-in.
- Device drift checks the device ID and supplied IMEI against recorded account history. A context flag can also indicate a new device.
- Channel hopping uses a supplied recent-change flag or the latest channel change within the rule's configured duration.
- Travel uses the Haversine distance between coordinate pairs and the time gap. Missing coordinates produce an unavailable feature, not an automatic fraud trigger.
- Recipient risk is a prototype heuristic: five or more distinct senders in 24 hours contribute 50; prior reject decisions contribute 25 each, capped at 100. It does not represent a validated fraud probability or confirmed mule status.
- Screen sharing contributes to the derived device score. The original 18 rules do not independently score it; a custom device-score rule can do so.
- Runtime, PIN, OTP, and channel flags are caller-supplied context. There is no telecom, device sensor, or account provider integration.

## Authentication

Persistent Vercel mode requires configured shared analyst authentication. Signed, expiring session cookies are HttpOnly, SameSite Strict, and Secure in production. API reads and writes verify authentication. Writes reject a conflicting Origin header. Password comparisons use timing-safe comparison. The shared role and instance-local login throttling are prototype boundaries, documented in the README.

## Future inference

Phase 2 should add a versioned model adapter after feature calculation. Store its input feature schema and prediction alongside the rule result. Choose a fusion strategy through offline validation rather than guessing weights. Analyst dispositions remain separate from initial screening evidence, so both can be exported for reviewed training.
