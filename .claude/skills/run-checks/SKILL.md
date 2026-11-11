---
name: run-checks
description: Run every GRIEVANCE quality gate (backend pytest, frontend lint/typecheck/test/build) and report real results.
---

1. `cd backend && python -m pytest -q` (inside the backend virtualenv).
2. `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`.
3. Report pass/fail counts exactly as printed. Fix failures at the root cause; never skip or weaken tests.
