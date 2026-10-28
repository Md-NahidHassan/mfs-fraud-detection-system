# MFS Rule-Based Fraud Detection System
## Full Implementation Plan

**Repository name:** `mfs-rule-based-fraud-detection`

## 1. Project Goal

Build a professional, real-time Mobile Financial Services (MFS) fraud detection prototype that evaluates transactions using deterministic fraud rules and produces a clear operational decision:

- `APPROVE`
- `STEP_UP_AUTH`
- `REJECT_AND_FREEZE`

The first phase will be rule-based so the full fraud workflow can be implemented, tested, demonstrated, and explained clearly. The system architecture will remain ready for a later machine-learning phase.

The project is based on the fraud-risk architecture described in the supplied MFS Fraud Risk Architecture document, especially its:
- fraud typologies,
- behavioral and liquidity features,
- device and topology indicators,
- geolocation checks,
- two-tier inference approach,
- decision matrix,
- explainability requirements.

---

## 2. Phase 1 Scope — Rule-Based Fraud Detection

### In scope

1. Transaction ingestion through an API.
2. Transaction simulator UI.
3. Feature calculation.
4. Rule engine.
5. Risk score calculation.
6. Decision engine.
7. Alert generation.
8. Case detail view.
9. Rule configuration page.
10. Transaction history.
11. User/device/recipient history.
12. Fraud dashboard.
13. Audit logging.
14. Seed/demo transaction scenarios.
15. Database persistence.
16. Backend validation.
17. Unit and API testing.

### Out of scope for Phase 1

The following are intentionally deferred:

- trained XGBoost/LightGBM model,
- automated model retraining,
- SHAP-based ML explanations,
- production event streaming,
- full graph-embedding model,
- telecom integration,
- production banking/MFS integrations.

These become part of Phase 2.

---

# 3. Recommended Technology Stack

## Backend

- Python 3.11+
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- SQLite for local demo
- PostgreSQL-ready database design
- Uvicorn
- Pytest

## Frontend

Recommended:

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui or carefully selected reusable components
- Recharts for charts
- Lucide icons

Alternative if a smaller stack is preferred:

- Next.js + TypeScript + Tailwind CSS

## Phase 2 ML stack

- pandas
- NumPy
- scikit-learn
- XGBoost or LightGBM
- SHAP
- joblib
- MLflow optional

---

# 4. High-Level Architecture

```text
                         ┌─────────────────────────┐
                         │   Fraud Operations UI   │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │      FastAPI API        │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │ Transaction Validation  │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │     Feature Engine      │
                         └────────────┬────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
          User History         Device History       Recipient/Agent
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      ▼
                         ┌─────────────────────────┐
                         │       Rule Engine       │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │    Risk Score Engine    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │     Decision Engine     │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
                 APPROVE       STEP_UP_AUTH     REJECT_AND_FREEZE
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │ Alert / Case Management │
                         └─────────────────────────┘
```

---

# 5. Suggested Repository Structure

```text
mfs-rule-based-fraud-detection/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   │
│   │   ├── api/
│   │   │   ├── transactions.py
│   │   │   ├── alerts.py
│   │   │   ├── cases.py
│   │   │   ├── rules.py
│   │   │   ├── users.py
│   │   │   └── dashboard.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── transaction.py
│   │   │   ├── alert.py
│   │   │   ├── case.py
│   │   │   └── rule.py
│   │   │
│   │   ├── models/
│   │   │   ├── transaction.py
│   │   │   ├── alert.py
│   │   │   ├── case.py
│   │   │   ├── fraud_rule.py
│   │   │   ├── user_profile.py
│   │   │   └── device_profile.py
│   │   │
│   │   ├── services/
│   │   │   ├── feature_engine.py
│   │   │   ├── rule_engine.py
│   │   │   ├── risk_engine.py
│   │   │   ├── decision_engine.py
│   │   │   ├── geo_service.py
│   │   │   └── audit_service.py
│   │   │
│   │   ├── database/
│   │   │   ├── session.py
│   │   │   └── seed.py
│   │   │
│   │   └── tests/
│   │       ├── test_rules.py
│   │       ├── test_risk.py
│   │       └── test_transactions.py
│   │
│   ├── requirements.txt
│   └── alembic/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── demo-scenarios.md
│
├── scripts/
│   └── seed_demo_data.py
│
├── .env.example
├── .gitignore
├── README.txt
└── IMPLEMENTATION_PLAN.md
```

---

# 6. Core Data Model

## Transaction

Recommended fields:

```text
id
transaction_id
user_id
msisdn
transaction_type
amount
fee
balance_before
balance_after
receiver_id
agent_id
channel
device_id
imei
sim_id
ip_address
latitude
longitude
timestamp
status
```

## Security / behavior context

```text
failed_pin_attempts
otp_resend_count
pin_reset_recently
balance_inquiry_count_5m
device_is_new
rooted_device
emulator_detected
vpn_active
screen_share_detected
channel_changed_recently
```

## Derived risk features

```text
depletion_ratio
turnaround_latency_seconds
tx_count_5m
tx_count_15m
tx_count_1h
tx_count_24h
amount_sum_5m
amount_sum_1h
impossible_travel_speed
recipient_risk_score
device_risk_score
user_behavior_score
rule_risk_score
```

---

# 7. Feature Engine

The feature engine converts raw transaction information into fraud indicators.

## 7.1 Balance depletion ratio

```text
(amount + fee) / available_balance
```

Example rule:

```text
>= 0.90 → suspicious
>= 0.97 → critical
```

## 7.2 Turnaround latency

Measure the time between recently received funds and the current outgoing transfer/cash-out.

Example:

```text
< 120 seconds → strong mule/smurfing signal
```

## 7.3 Rolling transaction velocity

Calculate:

```text
transaction_count_5m
transaction_count_15m
transaction_count_1h
transaction_count_24h
outbound_amount_5m
outbound_amount_1h
```

## 7.4 Credential activity

Risk indicators:

- repeated failed PIN attempts,
- recent PIN reset,
- repeated OTP resend requests.

## 7.5 Channel hopping

Example:

```text
Balance inquiry through app
       ↓
High-value cash-out through USSD
       ↓
Short time gap
       ↓
Suspicious channel hop
```

## 7.6 Balance inquiry surge

Detect repeated balance checks followed by a high-value transfer.

## 7.7 Device fingerprint drift

Check whether:

- device ID changed,
- IMEI changed,
- device is first seen,
- large transaction occurs shortly after new-device registration.

## 7.8 Runtime integrity

Detect flags for:

- root/jailbreak,
- emulator,
- VPN,
- remote desktop,
- screen-sharing application.

## 7.9 Impossible travel

Calculate:

```text
speed = geodesic_distance(previous_location, current_location)
        / time_difference
```

If the resulting physical speed is unrealistic, trigger a high-risk rule.

## 7.10 Recipient / mule behavior

Track:

- many senders → one receiver,
- receiver account age,
- recent high inflow,
- rapid onward cash-out,
- repeated transfer patterns.

---

# 8. Rule Engine

Rules should be stored as configuration rather than hard-coded across the codebase.

Example rule object:

```json
{
  "code": "RISK_001",
  "name": "High Balance Depletion",
  "category": "LIQUIDITY",
  "enabled": true,
  "weight": 20,
  "severity": "HIGH",
  "threshold": 0.9
}
```

Recommended Phase 1 rules:

| Code | Rule | Example Trigger | Weight |
|---|---|---:|---:|
| R001 | High balance depletion | >= 90% | 20 |
| R002 | Critical balance depletion | >= 97% | 35 |
| R003 | Failed PIN attempts | >= 3 | 15 |
| R004 | OTP resend surge | >= 3 | 10 |
| R005 | Recent PIN reset | true | 15 |
| R006 | New device | true | 10 |
| R007 | New device + high amount | true | 25 |
| R008 | Rooted device | true | 15 |
| R009 | Emulator detected | true | 20 |
| R010 | VPN active | true | 8 |
| R011 | Transaction velocity | > 5 in 5m | 20 |
| R012 | Rapid fund turnaround | < 120 sec | 25 |
| R013 | Channel hopping | true | 15 |
| R014 | Balance inquiry surge | true | 15 |
| R015 | Impossible travel | true | 40 |
| R016 | High-risk recipient | true | 25 |
| R017 | Blacklisted device | true | immediate reject |
| R018 | Blacklisted agent | true | immediate reject |

Weights must remain configurable so they can be tuned after testing.

---

# 9. Risk Scoring

Use a transparent 0–100 rule score.

Example:

```text
raw_score = sum(triggered_rule_weights)
risk_score = min(raw_score, 100)
```

Suggested decision bands:

```text
0–44     LOW
45–69    MEDIUM
70–84    HIGH
85–100   CRITICAL
```

Suggested actions:

```text
LOW       → APPROVE
MEDIUM    → STEP_UP_AUTH
HIGH      → STEP_UP_AUTH / TEMPORARY HOLD
CRITICAL  → REJECT_AND_FREEZE
```

The UI should always show *why* the score was produced.

Example:

```text
Risk Score: 87 / 100

Triggered rules
+40  Impossible travel
+20  High balance depletion
+15  Recent PIN reset
+12  New device / abnormal behavior
```

---

# 10. API Design

## Transactions

```text
POST   /api/v1/transactions/analyze
GET    /api/v1/transactions
GET    /api/v1/transactions/{id}
```

## Alerts

```text
GET    /api/v1/alerts
GET    /api/v1/alerts/{id}
PATCH  /api/v1/alerts/{id}
```

## Cases

```text
GET    /api/v1/cases
GET    /api/v1/cases/{id}
POST   /api/v1/cases/{id}/review
```

## Rules

```text
GET    /api/v1/rules
PATCH  /api/v1/rules/{id}
POST   /api/v1/rules
```

## Dashboard

```text
GET    /api/v1/dashboard/summary
GET    /api/v1/dashboard/risk-distribution
GET    /api/v1/dashboard/recent-alerts
```

---

# 11. Professional UI Plan

The UI must feel like a real fraud operations product, not a generic AI-generated admin template.

## Design direction

Use a restrained financial-security visual language:

- clean grid,
- strong information hierarchy,
- generous whitespace,
- compact but readable tables,
- subtle borders,
- low visual noise,
- no excessive gradients,
- no glassmorphism,
- no oversized marketing cards,
- no random decorative illustrations,
- no fake AI-style glowing elements,
- no unnecessary animations,
- no emoji icons.

### Typography

Use one modern sans-serif family, such as:

- Inter,
- Geist,
- IBM Plex Sans.

Recommended hierarchy:

```text
Page title:       28–32 px / 600
Section title:    18–20 px / 600
Card value:       24–30 px / 600
Body:             14–16 px / 400
Table text:       13–14 px
Labels:           12–13 px / 500
```

### Color behavior

Use color only for meaning.

```text
Green   → approved / healthy
Amber   → verification / medium risk
Red     → rejected / critical
Blue    → navigation / selected state
Neutral → surfaces and secondary content
```

Avoid using strong color on every card.

---

# 12. UI Screens

## 12.1 Dashboard

Top-level KPIs:

```text
Total Transactions
Approved
Step-Up Authentication
Rejected / Frozen
Open Fraud Cases
```

Main dashboard sections:

1. risk distribution,
2. transaction volume trend,
3. recent fraud alerts,
4. top triggered rules,
5. high-risk recipients,
6. suspicious devices.

Suggested layout:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Fraud Operations                                      [Analyst] │
├──────────────┬───────────────────────────────────────────────────┤
│ Dashboard    │  Total      Approved    Step-Up     Rejected      │
│ Transactions │  12,482     11,974      394         114           │
│ Alerts       ├───────────────────────────┬───────────────────────┤
│ Cases        │ Risk Distribution         │ Transaction Volume    │
│ Rules        │                           │                       │
│ Simulator    ├───────────────────────────┴───────────────────────┤
│              │ Recent Fraud Alerts                               │
│              │ Tx ID | User | Amount | Risk | Decision | Time   │
└──────────────┴───────────────────────────────────────────────────┘
```

---

## 12.2 Transaction Simulator

Purpose: allow a presenter to create realistic transaction scenarios quickly.

Sections:

### Transaction

- user ID,
- transaction type,
- amount,
- balance,
- receiver/agent.

### Channel

- app,
- USSD,
- agent.

### Security context

- failed PIN count,
- OTP resend count,
- PIN reset,
- new device,
- rooted device,
- VPN,
- emulator.

### Location

- latitude,
- longitude,
- previous transaction location,
- time gap.

Primary action:

```text
Analyze Transaction
```

Secondary actions:

```text
Load Normal Scenario
Load Suspicious Scenario
Load Fraud Scenario
Reset
```

The preset buttons are useful during a live demonstration.

---

## 12.3 Analysis Result

This is the most important page in the demo.

Header example:

```text
Transaction Risk Analysis

Risk Score
87 / 100

CRITICAL RISK

Decision
REJECT & FREEZE
```

Then display:

### Triggered rules

```text
Impossible Travel                    +40
High Balance Depletion               +20
Recent PIN Reset                     +15
New Device                           +10
VPN Detected                          +8
```

### Context cards

```text
Transaction
Account Behaviour
Credential Activity
Device Integrity
Location
Recipient Risk
```

### Timeline

Show:

```text
19:41  Balance inquiry
19:43  Failed PIN attempt
19:45  OTP resend
19:47  PIN reset
19:49  New-device login
19:51  Cash-out attempt
```

This gives the demo a strong investigative feel.

---

## 12.4 Alerts Page

Table columns:

```text
Alert ID
Transaction
User
Amount
Risk
Triggered Rules
Decision
Status
Timestamp
```

Filters:

- risk level,
- decision,
- alert status,
- transaction type,
- date range.

Statuses:

```text
New
Under Review
Confirmed Fraud
False Positive
Closed
```

---

## 12.5 Case Detail Page

Left side:

- transaction information,
- account information,
- device information,
- location,
- recipient.

Right side:

- risk score,
- triggered rules,
- analyst notes,
- case status,
- action history.

Actions:

```text
Confirm Fraud
Mark False Positive
Request Verification
Release Hold
Keep Frozen
```

These analyst labels will become valuable training labels in Phase 2.

---

## 12.6 Rule Configuration Page

Columns:

```text
Rule
Category
Threshold
Weight
Severity
Enabled
Last Updated
```

Editing should happen in a drawer or modal.

Avoid putting raw technical configuration directly in the main table.

---

# 13. Demo Scenarios

Prepare at least three deterministic scenarios.

## Scenario A — Normal

```text
Amount              1,000 BDT
Balance             15,000 BDT
Known device        Yes
Failed PIN          0
OTP resend          0
VPN                  No
Location            Normal
Velocity            Normal
```

Expected result:

```text
LOW
APPROVE
```

---

## Scenario B — Suspicious

```text
Amount              20,000 BDT
Balance             25,000 BDT
New device          Yes
Failed PIN          2
OTP resend          2
High depletion      Yes
Channel hop         Yes
```

Expected result:

```text
MEDIUM / HIGH
STEP_UP_AUTH
```

---

## Scenario C — Fraud-Like

```text
Amount              49,000 BDT
Balance             50,000 BDT
Failed PIN          4
OTP resend          5
Recent PIN reset    Yes
New device          Yes
VPN                  Yes
Impossible travel   Yes
```

Expected result:

```text
CRITICAL
REJECT_AND_FREEZE
```

---

# 14. Database Tables

Recommended minimum tables:

```text
users
devices
transactions
transaction_features
fraud_rules
rule_triggers
alerts
fraud_cases
case_actions
audit_logs
recipients
agents
```

Important relationships:

```text
user
 ├── devices
 ├── transactions
 └── cases

transaction
 ├── calculated_features
 ├── triggered_rules
 ├── alert
 └── case
```

---

# 15. Auditability

Every analyzed transaction should save:

```text
transaction payload
calculated features
rule version
rules triggered
individual rule weights
final score
decision
timestamp
```

Never return only:

```text
risk = 87
```

Return an explainable result:

```json
{
  "risk_score": 87,
  "risk_level": "CRITICAL",
  "decision": "REJECT_AND_FREEZE",
  "triggered_rules": [
    {
      "code": "R015",
      "name": "Impossible Travel",
      "weight": 40
    },
    {
      "code": "R001",
      "name": "High Balance Depletion",
      "weight": 20
    }
  ]
}
```

---

# 16. Testing Plan

## Unit tests

Test each rule independently.

Examples:

```text
depletion ratio
impossible travel
failed PIN threshold
OTP threshold
new-device detection
velocity calculation
channel hopping
risk-score capping
```

## API tests

Test:

```text
valid transaction
invalid transaction
normal transaction
medium-risk transaction
critical transaction
blacklisted device
missing location data
```

## UI tests

Verify:

- correct risk badge,
- correct action,
- proper loading state,
- error handling,
- filters,
- responsive layout,
- empty state,
- no duplicated alerts.

---

# 17. Implementation Order

## Sprint 1 — Foundation

- create repo,
- backend project,
- frontend project,
- database connection,
- base layout,
- navigation,
- transaction schema.

## Sprint 2 — Core Fraud Engine

- feature engine,
- initial rules,
- score engine,
- decision engine,
- tests.

## Sprint 3 — Transaction Workflow

- analyze transaction API,
- save transaction,
- save triggered rules,
- simulator UI,
- result UI.

## Sprint 4 — Fraud Operations UI

- dashboard,
- alerts,
- case details,
- transaction history,
- filters.

## Sprint 5 — Administrative Controls

- rule configuration,
- rule enable/disable,
- configurable thresholds,
- audit history.

## Sprint 6 — Demo Quality

- seed realistic data,
- three demo scenarios,
- loading/error states,
- responsive polish,
- accessibility check,
- presentation rehearsal.

---

# 18. Phase 2 — Machine Learning Upgrade

The repository should explicitly remain ready for an ML-based second phase.

## Phase 2 goals

1. Build or obtain a labelled fraud dataset.
2. Convert rule-engine features into model-training features.
3. Perform preprocessing and data quality checks.
4. Create train/validation/test splits.
5. Train models such as:
   - XGBoost,
   - LightGBM.
6. Compare models using:
   - precision,
   - recall,
   - F1,
   - ROC-AUC,
   - PR-AUC,
   - confusion matrix.
7. Choose operating thresholds based on fraud-detection requirements.
8. Save the selected trained model.
9. Load the model inside the inference service.
10. Combine rule score and ML score.
11. Add SHAP explanations.
12. Use analyst-confirmed fraud / false-positive labels for future retraining.

Future architecture:

```text
Transaction
    │
    ▼
Feature Engine
    │
    ├──────────► Rule Engine ──────► Rule Score
    │
    └──────────► ML Model ─────────► ML Risk
                                  │
                                  ▼
                           Risk Fusion Engine
                                  │
                                  ▼
                              Decision
```

Possible hybrid score:

```text
final_risk =
    rule_component
  + behavioral_component
  + device_component
  + graph_component
  + ML_component
```

The exact weighting should be determined through validation rather than guessed.

---

# 19. Definition of Done for Phase 1

Phase 1 is complete when:

- transactions can be submitted from the UI,
- backend validates them,
- fraud features are calculated,
- rule engine evaluates them,
- a 0–100 risk score is produced,
- a decision is returned,
- triggered rules are displayed,
- alerts are stored,
- case details are available,
- rule configuration works,
- three demo scenarios work reliably,
- automated tests pass,
- the dashboard looks production-oriented and consistent,
- the README clearly describes Phase 2 ML training.

---

# 20. Final Product Positioning

Phase 1 should be presented as:

> A transparent, explainable rule-based MFS fraud risk engine designed for real-time transaction screening and fraud-operations review.

Phase 2 should be presented as:

> A hybrid fraud detection system combining deterministic controls with trained machine-learning risk inference and explainability.

This keeps the current implementation achievable while providing a credible path toward the ML-based architecture.
