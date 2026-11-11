# Safety & policy rules

- All status changes go through `services/grievances.transition()`; never assign `grievance.status` directly.
- `AI_SYSTEM` may not: close a sensitive grievance (POL-SENSITIVE-02), close a category with `auto_close_allowed=false`
  (POL-AUTOCLOSE-01), or release a case from `PENDING_REVIEW` (POL-REVIEW-01). There is no REJECTED status.
- New AI capabilities must be added to `policy.BASE_AI_ACTIONS` explicitly and checked with `assert_ai_action_allowed`.
- Low confidence (< category threshold), sensitive categories, sensitive keyword signals and prompt-injection
  patterns route to human review. Do not weaken these without updating `backend/tests/test_policy.py`.
- RAG precedents and duplicate links are evidence only. Duplicate grouping links records — never merges or deletes.
- Predictions computed on SYNTHETIC history must carry `predictive.estimate_label()`.
