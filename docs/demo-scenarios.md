# Demonstration

Start with the default policy and use isolated scenario accounts. Repeated submissions contribute to history, and policy edits can change expected decisions.

| Scenario | Inputs | Default result |
| --- | --- | --- |
| Normal | BDT 1,000 out of 15,000; known device; no security flags | 0, LOW, APPROVE |
| Suspicious | BDT 20,000 out of 25,000; new device; channel change | 50, MEDIUM, STEP_UP_AUTH |
| Fraud-like | BDT 49,000 out of 50,000; failed PINs; OTP surge; PIN reset; new device; VPN; Dhaka/Chattogram location in five minutes | 100, CRITICAL, REJECT_AND_FREEZE |

The suspicious scenario's depletion is 80%, so it does **not** trigger the 90% depletion rule. Its score comes from new device (+10), new device and high amount (+25), and channel hopping (+15). This resolves the inconsistency in the original scenario description.

1. Open Simulator and load Normal transaction. Analyze and inspect its approval.
2. Load Suspicious activity and inspect the three trigger explanations.
3. Load Fraud-like cash-out and inspect its capped score, policy snapshot, and calculated travel feature.
4. Open the saved record, add analyst notes, and save a case disposition.
5. Return to the dashboard and audit log to see the corresponding records.
6. Edit a rule, analyze a fresh transaction ID, and compare the new decision with the original record. Past evidence remains unchanged.

Blocklist examples use `device-blacklisted` and `agent-blacklisted` in the synthetic configuration. Real blocklists are server-managed in `mfs_meta`; transaction callers cannot supply an authoritative blacklist flag.
