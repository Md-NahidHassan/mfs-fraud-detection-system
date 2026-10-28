# API

All workflow endpoints are under `/api/v1`. Authentication uses the same analyst session cookie as the UI. Responses are JSON and are not cached. Errors use `{ "error": "message", "issues": [...] }` where applicable.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/transactions/analyze` | Validate, analyze, persist, and create a flagged case |
| GET | `/transactions` | Transaction history |
| GET | `/transactions/{id}` | Full evidence; internal or external transaction ID |
| GET | `/alerts`, `/alerts/{id}` | Alerts with their related transactions |
| PATCH | `/alerts/{id}` | Update alert status and audit it |
| GET | `/cases`, `/cases/{id}` | Case records with transaction evidence |
| POST | `/cases/{id}/review` | Record an analyst action and notes |
| GET | `/rules` | Current policy |
| PATCH | `/rules/{code}` | Update weight, threshold, severity, or enabled state |
| POST | `/rules` | Create a custom numeric feature rule |
| GET | `/dashboard/summary` | Counts, distribution, trend, and rule frequency |
| GET | `/dashboard/risk-distribution` | Risk band counts |
| GET | `/dashboard/recent-alerts` | Latest cases |
| GET | `/users`, `/devices`, `/recipients`, `/agents` | Derived entity profiles |
| GET | `/{entity-type}/{id}` | Entity profile and transaction history |
| GET | `/audit` | Audit events |
| GET | `/workspace` | Combined UI snapshot |

Lists are unpaginated in the prototype. The UI applies filters locally. Alert IDs and case IDs share the same flagged transaction case record, so updates remain consistent.

## Analyze a transaction

```json
{
  "transaction_id": "TX-EXAMPLE-001",
  "user_id": "customer-001",
  "transaction_type": "SEND_MONEY",
  "amount": 1000,
  "balance_before": 15000,
  "timestamp": "2026-10-04T12:00:00+06:00",
  "device_id": "device-001",
  "receiver_id": "recipient-001"
}
```

Required fields are transaction ID, user ID, transaction type, positive amount, balance before, and an ISO timestamp including timezone. See `src/lib/domain.ts` for the full schema and defaults. Amount and fee must fit the balance for outgoing transactions. Unknown fields, negative counters, invalid coordinates, invalid MSISDN values, and context timestamps after the transaction are rejected. Coordinate pairs are optional but must be supplied together.

The response includes `id`, `payload`, `features`, `triggered_rules`, `rule_snapshot`, `risk_score`, `risk_level`, `decision`, `balance_after`, and `created_at`. `balance_after` is a projection, not an executed balance change.

Use a new transaction ID for each attempt. An identical replay returns the original saved decision without creating a second alert; a conflicting replay returns 409.

## Case review

```json
{ "action": "CONFIRM_FRAUD", "note": "Recorded evidence supports this disposition." }
```

Actions: `CONFIRM_FRAUD`, `MARK_FALSE_POSITIVE`, `REQUEST_VERIFICATION`, `RELEASE_HOLD`, `KEEP_FROZEN`. Notes must contain 5–2,000 characters. Reviews preserve the initial transaction decision.

Alert statuses: `NEW`, `UNDER_REVIEW`, `CONFIRMED_FRAUD`, `FALSE_POSITIVE`, `CLOSED`. PATCH accepts `{ "status": "UNDER_REVIEW" }`.

## Rule configuration

PATCH accepts `enabled`, `weight` (integer 0–100), `threshold`, and `severity`. Depletion thresholds use ratios from 0 through 1. R007 is an amount threshold, R011 a count, R012 and R013 seconds, R015 km/h, and R016 a score. Boolean/blocklist thresholds are informational; those rules use their signal directly.

Custom rule example:

```json
{
  "code": "CUSTOM_DEVICE_SCORE",
  "name": "Elevated device risk",
  "description": "Require review for a combined device integrity signal.",
  "category": "DEVICE",
  "enabled": true,
  "weight": 45,
  "threshold": 50,
  "severity": "HIGH",
  "condition": { "feature": "device_risk_score", "operator": "gte" }
}
```

Supported custom features: `depletion_ratio`, `tx_count_5m`, `amount_sum_1h`, `recipient_risk_score`, `device_risk_score`, `user_behavior_score`. Operators: `gte`, `gt`, `lt`. Codes must begin with `CUSTOM_`. No arbitrary code or expressions are executed.

## Session endpoints

POST `/api/auth` with `{ "password": "..." }` signs in and sets an eight-hour session cookie. DELETE `/api/auth` clears it. API errors include 400 for malformed JSON, 401 for missing authentication, 403 for conflicting origins, 404 for missing records, 409 for conflicts, 422 for schema validation, and 503 for unavailable storage or configuration.
