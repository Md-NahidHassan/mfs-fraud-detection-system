# MFS Fraud Operations
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
TypeScript and Next.js, delegated by the user's request for a JavaScript alternative deployable on Vercel. PostgreSQL prepared for a new database, confirmed by the user.
## Users
Fraud analysts investigate transaction risk; presenters demonstrate deterministic scenarios, as specified in IMPLEMENTATION_PLAN.md.
## Product Purpose
Explainable transaction screening with APPROVE, STEP_UP_AUTH, and REJECT_AND_FREEZE decisions.
## Capabilities and Constraints
Implement Phase 1 from the supplied plan. No Python backend. No production payment or telecom integration. Data and scenarios are synthetic. Freeze decisions represent recommendations, not actions on real wallets.
## Evidence on Hand
IMPLEMENTATION_PLAN.md is the product and visual brief. The source repository was empty at initialization.
## Product Principles
Preserve decision evidence; make review actions traceable; separate synthetic demonstration from persistent operations.
