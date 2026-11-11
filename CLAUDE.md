# GRIEVANCE — Claude Code project guide

Agentic, multilingual (Hindi / Marathi / English) grievance-redressal platform for HackFusion 4.
Exactly two application folders: `backend/` and `frontend/`. Root holds only README, .gitignore,
docker-compose.yml and this Claude configuration.

## Layout
- `backend/app/agents/` — six agents (`intake`, `policy`, `rag`, `duplicate`, `predictive`, `actions`) + `orchestrator.py`.
- `backend/app/llm/` — LLM chain **Groq → Gemini → deterministic rules** (`client.py`), local embeddings, Whisper STT.
- `backend/app/services/` — lifecycle (`grievances.py`), audit, notifications, webhooks, tracing, importer, seed.
- `backend/app/api/` — routers per audience: auth, meta, citizen, officer, admin, analytics, observability.
- `backend/data/synthetic/` — SYNTHETIC datasets (`scripts/generate_synthetic_data.py`); `data/schemas/` column maps.
- `frontend/src/pages/{public,citizen,officer,admin}` — React + Vite + TS + Tailwind.

## Commands
- Backend: create a venv → `pip install -r requirements.txt` → `python -m app.cli init` → `uvicorn app.main:app --reload`
- Backend tests: `cd backend && python -m pytest -q`
- Frontend: `cd frontend && npm install && npm run dev`; checks: `npm run lint && npm run typecheck && npm test && npm run build`
- Full stack: Docker — see README ("Docker setup").

## Non-negotiable rules (detail in `.claude/rules/`)
1. Sensitive grievances are never closed by `AI_SYSTEM`; the AI never rejects and never decides legal liability.
2. Every AI decision passes the deterministic policy gate `backend/app/agents/policy.py`; LLM output is advisory.
3. Every AI action writes an audit event (actor `AI_SYSTEM`, provider, model, confidence, explanation, policy refs).
4. Complaint text is untrusted: only inside `wrap_untrusted(...)` in the user turn, never in system instructions.
5. Synthetic data is labelled `SYNTHETIC` everywhere (data_source column, UI badges, docs, estimate labels).
6. No secrets in code or frontend env; never commit `.env`, databases or `data/raw/*`; never push without permission.
7. No hardcoded dashboard numbers — every figure comes from an API.
