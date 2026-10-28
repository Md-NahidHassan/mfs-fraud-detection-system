# MFS Guard

**Spot suspicious transfers. Explain every decision. Act with confidence.**

A Mobile Financial Services fraud detection workspace built with Next.js, React, TypeScript, and PostgreSQL.

## Phase 2: smarter detection with LightGBM

**Next up:** combine explainable rules with a trained LightGBM model to catch more fraud and reduce false alarms. This phase is planned; the current app uses rule-based screening.

- **Training data:** use analyst-confirmed fraud and false-positive labels with transaction, velocity, balance, device, and recipient features. Keep only information available at screening time and split training, validation, and test data chronologically.
- **Improve LightGBM:** tune leaf count, tree depth, learning rate, and minimum samples per leaf; use early stopping and validate class weighting for imbalanced fraud data. See the [LightGBM tuning guide](https://lightgbm.readthedocs.io/en/stable/Parameters-Tuning.html).
- **Measure results:** compare against the rule engine using PR-AUC, precision, recall, F1, and false-positive rate. Choose decision thresholds on validation data and report final results on the held-out test set.
- **Explain and integrate:** add SHAP explanations, versioned models and feature schemas, and validated model-plus-rule decisions. Monitor drift and retrain with reviewed cases.

## What works today

- 18 configurable fraud rules, custom rules, and transparent risk scores from 0–100.
- Decisions: `APPROVE`, `STEP_UP_AUTH`, or `REJECT_AND_FREEZE`.
- Dashboard, transaction simulator, alerts, case reviews, entity history, and CSV export.
- Saved decision evidence, policy snapshots, analyst notes, and audit trails.

Demo records are synthetic; freeze and release actions record recommendations.

## Quick start

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## API

JSON endpoints use the analyst session cookie. Workflow routes start at `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST / DELETE | `/api/auth` | Sign in / sign out |
| POST | `/api/v1/transactions/analyze` | Screen and save a transaction |
| GET | `/api/v1/transactions`, `/api/v1/transactions/{id}` | Browse history and decision evidence |
| GET / PATCH | `/api/v1/alerts/{id}` | View or update an alert |
| POST | `/api/v1/cases/{id}/review` | Record a review and analyst notes |
| GET / POST | `/api/v1/rules` | List or create rules |
| PATCH | `/api/v1/rules/{code}` | Update a rule |
| GET | `/api/v1/dashboard/summary`, `/api/v1/audit` | Dashboard metrics and audit history |

See the [API reference](docs/api.md) for payloads, responses, and all endpoints.

## Docs

- [Architecture](docs/architecture.md) — scoring, storage, and authentication.
- [Demo scenarios](docs/demo-scenarios.md) — sample transactions and expected decisions.
- [Implementation plan](IMPLEMENTATION_PLAN.md) — system design and roadmap.
