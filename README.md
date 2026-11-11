# GRIEVANCE

**An autonomous, agentic, multilingual grievance-redressal ecosystem** — built for HackFusion 4.

Citizens report civic problems in **Hindi, Marathi or English**, by typing or speaking. Six cooperating agents
classify, route, retrieve precedents, link duplicates, predict SLA risk and act through controlled backend APIs, while a
deterministic policy gate keeps sensitive and uncertain cases under human control. Every automated step is
audited and traced.

> **Data notice.** The official HackFusion datasets (Category Master, Mock Grievance History, Department Directory)
> are not yet available. Everything shipped in `backend/data/synthetic/` is **generated SYNTHETIC demo data**. It is
> labelled `SYNTHETIC` in the database, the UI (banner + badges) and every prediction ("demo estimate"). Replace it
> through the importer when the official files arrive — no code change needed.

---

## Contents
1. [Features](#features) · 2. [Architecture](#architecture) · 3. [Folder structure](#folder-structure) ·
4. [Prerequisites](#prerequisites) · 5. [Backend setup](#backend-setup) · 6. [Frontend setup](#frontend-setup) ·
7. [Environment configuration](#environment-configuration) · 8. [Docker setup](#docker-setup) ·
9. [Database migrations](#database-migrations) · 10. [Dataset import](#dataset-import) · 11. [API documentation](#api-documentation) ·
12. [Testing](#testing) · 13. [Demo workflow](#demo-workflow) · 14. [Limitations](#known-limitations)

---

## Features

### The six agents (`backend/app/agents/`)
| # | Agent | What it does |
|---|-------|--------------|
| 1 | **Multilingual intake** (`intake.py`) | Hindi / Marathi / English text or Whisper-transcribed voice → category, location/ward, urgency, department, summary. Produces a **draft**; nothing is filed until the citizen reviews and confirms. |
| 2 | **Policy & safety** (`policy.py`) | Deterministic gate driven by the Category Master: department + SLA mapping, sensitive flag, identity hiding, per-category confidence threshold, prompt-injection and sensitive-keyword signals → human review. Defines the only actions the AI may take. |
| 3 | **RAG precedents** (`rag.py`) | Local multilingual embeddings + pgvector cosine search for top-k resolved grievances, filtered category → department → all, with source IDs and summaries. Evidence only. |
| 4 | **Duplicate grouping** (`duplicate.py`) | Semantic + geographic + time + category score. Links reports into a group; every grievance keeps its own ID, status, notifications and audit trail. Officers can unlink. |
| 5 | **Predictive SLA & recurrence** (`predictive.py`) | Breach probability from historical resolution times × department load; at-risk warnings, breach escalation, recurring category×ward hotspots, department bottlenecks, officer workload. |
| 6 | **Backend actions** (`actions.py`) | Department/officer assignment (least-loaded, ward-aware, sensitive-authorised), status updates, escalation, notifications, signed webhooks, audit events. |

The **orchestrator** (`orchestrator.py`) runs them as traced workflows: `intake_analysis`, `grievance_pipeline`,
`sla_scan` (also on a background timer) and `auto_close`.

### LLM chain: Groq → Gemini → rules
`backend/app/llm/client.py` tries **Groq** first, falls back to **Gemini** if Groq fails or returns invalid output,
and falls back to a **deterministic multilingual rule engine** when neither is configured or both fail. All LLM
output is schema-validated, cross-checked against the rule classifier and passed through the policy gate — it is
advisory only. The system is fully functional with no API keys.

### Safety guarantees (enforced in code and covered by tests)
- Sensitive grievances are **never closed by `AI_SYSTEM`**; categories without auto-close are never auto-closed.
- Low-confidence classifications go to **human review**; the AI cannot release a case from review.
- There is **no rejection status** — no automatic (or manual) rejection.
- The AI makes **no liability determinations**.
- Every AI action writes an **audit event**: actor `AI_SYSTEM`, provider, model, confidence, timestamp, structured
  explanation, policy references, action, grievance ID, trace ID.
- Complaint text is **untrusted input**: delimited in the user turn, never placed in instructions; instruction-like
  text routes the case to a human.

### Applications
- **Citizen portal** — landing page, registration/login, AI complaint assistant (text + voice), review & confirmation,
  grievance ID, tracking with status history, notifications, resolution confirmation with rating, dispute → reopen.
- **Officer dashboard** — assigned / department / human-review queues with filters, AI summary, policy explanation,
  confidence vs threshold, similar precedents, linked duplicates, SLA countdown and prediction, escalation, notes,
  status management, reassignment, audit trail.
- **Administrator dashboard** — live statistics, trends, department SLA performance, category mix, SLA watchlist,
  recurrence hotspots, bottlenecks, officer workload, agent activity, Category Master editor, department directory,
  dataset import, webhooks, audit log.
- **Observability** — every agent step with provider/model, confidence, retrieved references, policy decision,
  actions, errors, timing and human-review decisions; **shareable redacted trace links**; optional **Langfuse**
  export (public traces) when keys are set.

### Security
JWT auth, role-based access (citizen / officer / admin) plus object-level checks, bcrypt hashing, Pydantic validation,
rate limiting on auth and intake, identity masking (sensitive cases show "Identity protected"), PII redaction in
traces and audit explanations, secure error responses with reference IDs, security headers, env-only secrets.

---

## Architecture

```text
 Browser (React + Vite + TS + Tailwind)
   │  REST /api/v1  (JWT)
   ▼
 FastAPI ── routers: auth · meta · citizen · officer · admin · analytics · observability
   │
   ├── Orchestrator ──► 1 Intake ──► 2 Policy gate ──► 3 RAG ──► 4 Duplicates ──► 5 Predictive SLA ──► 6 Actions
   │                      │  ▲                                                                           │
   │                      ▼  │ schema-validated JSON                                                     ▼
   │            LLM chain: Groq → Gemini → rules            status machine · notifications · webhooks · audit
   │            Local embeddings (multilingual MiniLM) · Whisper STT
   │
   ├── Tracing (DB, always) ──► optional Langfuse export
   └── SQLAlchemy 2 + Alembic ──► PostgreSQL 16 + pgvector  (SQLite supported for tests / quick dev)
```

Grievance lifecycle: `SUBMITTED → PENDING_REVIEW | ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`, with
`RESOLVED/CLOSED → REOPENED` on citizen dispute. All transitions go through `services/grievances.transition()`.

---

## Folder structure

```text
GRIEVANCE/
├── backend/
│   ├── app/
│   │   ├── agents/        six agents + orchestrator
│   │   ├── api/           REST routers, serializers, access control
│   │   ├── core/          config, security, deps, errors, privacy, rate limit
│   │   ├── db/            engine/session, portable vector type
│   │   ├── llm/           Groq/Gemini client, embeddings, Whisper
│   │   ├── models/        SQLAlchemy models
│   │   ├── schemas/       Pydantic request/response models
│   │   ├── services/      lifecycle, audit, notifications, webhooks, tracing, importer, seed, geo
│   │   ├── cli.py         init / migrate / import / sla-scan / auto-close / reembed
│   │   └── main.py        FastAPI app
│   ├── alembic/           migrations
│   ├── data/
│   │   ├── synthetic/     SYNTHETIC demo datasets (CSV)
│   │   ├── schemas/       importer column maps (JSON)
│   │   └── raw/           official files go here (git-ignored)
│   ├── docs/              presentation and supporting docs
│   ├── scripts/           generate_synthetic_data.py
│   ├── tests/             pytest suite
│   ├── .env / .env.example
│   ├── requirements.txt / requirements-ml.txt
│   └── Dockerfile
├── frontend/
│   ├── src/               pages (public, citizen, officer, admin), components, lib, tests
│   ├── public/
│   ├── .env / .env.example
│   ├── package.json
│   ├── nginx.conf
│   └── Dockerfile
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Prerequisites
- **Python 3.10+** (3.11 in Docker)
- **Node.js 20+** (22 recommended) and npm
- **Docker Desktop** (for PostgreSQL + pgvector or the full stack)
- Optional: Groq and/or Gemini API keys; ~1 GB disk for the local embedding + Whisper models

---

## Backend setup

```bash
cd backend
python -m venv .venv                 # or: uv venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Optional local models (multilingual embeddings + Whisper voice input):
pip install -r requirements-ml.txt   # CPU torch: pip install torch --index-url https://download.pytorch.org/whl/cpu

cp .env.example .env                 # then edit; see "Environment configuration"
docker compose up -d db              # from the repo root, if using PostgreSQL
python -m app.cli init               # migrate + seed SYNTHETIC data + demo accounts + demo grievances
uvicorn app.main:app --reload --port 8000
```

API: <http://localhost:8000/api/v1/docs>. For a zero-dependency start set `DATABASE_URL=sqlite:///./grievance.db`.

Demo accounts (synthetic, development only; password = `DEMO_PASSWORD`, default `Demo@12345`):

| Role | E-mail |
|------|--------|
| Citizen | `citizen@example.org`, `citizen2@example.org` |
| Officer (Water) | `officer.water@example.org` |
| Officer (Roads) | `officer.roads@example.org` |
| Officer (Women & Child Safety — sensitive cases) | `officer.safety@example.org` |
| Administrator | `admin@example.org` |

## Frontend setup

```bash
cd frontend
cp .env.example .env                 # VITE_API_BASE_URL=http://localhost:8000/api/v1
npm install
npm run dev                          # http://localhost:5173
```

---

## Environment configuration

Each application has its **own** env files; nothing is shared and there is no root `.env`.

**`backend/.env`** (secrets live only here — see `backend/.env.example` for every key)

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | `postgresql+psycopg://…` (pgvector) or `sqlite:///./grievance.db` |
| `JWT_SECRET`, `JWT_EXPIRE_MINUTES` | Token signing — use a long random value |
| `CORS_ORIGINS` | Allowed browser origins |
| `GROQ_API_KEY`, `GROQ_MODEL` | Primary LLM (optional) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Fallback LLM when Groq fails (optional) |
| `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL` | `auto` / `sentence-transformers` / `hashing` |
| `STT_PROVIDER`, `WHISPER_MODEL` | Whisper voice input (`auto` / `faster-whisper` / `disabled`) |
| `DEFAULT_CONFIDENCE_THRESHOLD`, `DUPLICATE_*`, `SLA_*`, `AUTO_CLOSE_AFTER_DAYS` | Policy tuning |
| `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | Optional Langfuse export |
| `WEBHOOK_SIGNING_SECRET` | HMAC key for outgoing webhooks |
| `SEED_DEMO_USERS`, `DEMO_PASSWORD` | Development seed |

**`frontend/.env`** — public values only: `VITE_API_BASE_URL`, `VITE_APP_NAME`. Never put keys here.

Model names change over time; set `GROQ_MODEL` / `GEMINI_MODEL` to any current model your account offers.

---

## Docker setup

Docker runs three containers: **db** (PostgreSQL 16 + pgvector), **backend** (FastAPI; migrates and seeds on start)
and **frontend** (nginx serving the built app).

```bash
# from the repo root, with Docker Desktop running and backend/.env present
docker compose up --build -d
```

**Windows note:** with Docker Compose v5 + Buildx 0.38 on Windows, `compose up --build` can stop with
`additional privileges requested: pass "--allow=fs.read=frontend\Dockerfile"`. Build the two images directly, then start Compose
without building:

```bash
docker build -t grievance-backend ./backend
docker build -t grievance-frontend --build-arg VITE_API_BASE_URL=http://localhost:8000/api/v1 ./frontend
docker compose up -d
```

| Service | URL |
|---------|-----|
| Web app | <http://localhost:8080> |
| API docs | <http://localhost:8000/api/v1/docs> |
| PostgreSQL | `localhost:5432` (grievance / grievance) |

Useful commands: `docker compose logs -f backend`, `docker compose ps`, `docker compose down` (keep data),
`docker compose down -v` (also delete the database volume).
The backend image is built without the large ML models by default (hashing embeddings, no voice). To include them,
build with `--build-arg INSTALL_ML=true`.

---

## Database migrations
Alembic (`backend/alembic/`) works for PostgreSQL and SQLite; on PostgreSQL the migration creates the `vector`
extension and an HNSW cosine index on `grievances.embedding`.

```bash
cd backend
python -m app.cli migrate                                # alembic upgrade head
alembic revision --autogenerate -m "describe change"     # after changing models
```

Tables: users, departments, officers, grievance_categories, grievances, assignments, status_history, officer_notes,
notifications, duplicate_groups, duplicate_group_members, retrieved_precedents, sla_records, audit_events,
agent_traces, agent_runs, webhooks, webhook_deliveries, dataset_imports, intake_drafts.

---

## Dataset import
Four dataset kinds, each with a column map in `backend/data/schemas/<kind>.json` (accepted header aliases, types,
required fields): `departments`, `categories`, `officers`, `grievance_history`. CSV and XLSX are supported.

- **UI:** Admin → Datasets → choose kind and source → *Validate (dry run)* → *Import*.
- **CLI:**
  ```bash
  cd backend
  python -m app.cli import categories data/raw/category_master.xlsx --official --dry-run
  python -m app.cli import categories data/raw/category_master.xlsx --official
  python -m app.cli reembed     # after importing history or changing the embedding model
  ```
Import order: departments → categories → officers → grievance_history. Rows are tagged `OFFICIAL` or `SYNTHETIC`.
A row never silently overwrites a record from another source; pass `--replace` (or tick the option in the UI) to
replace SYNTHETIC records deliberately. Every import is logged and audited. Regenerate the demo data with
`python scripts/generate_synthetic_data.py`.

---

## API documentation
Interactive OpenAPI docs: **`/api/v1/docs`** (Swagger) and **`/api/v1/redoc`**. Main groups:

| Prefix | Audience | Highlights |
|--------|----------|-----------|
| `/auth` | all | register, login, me |
| `/meta` | public | categories, departments, wards, system status (LLM chain, embeddings, STT, data sources) |
| `/citizen` | citizen | `intake/analyze`, `intake/transcribe`, `intake/{token}/confirm`, grievances, confirm-resolution, dispute |
| `/notifications` | all | list, mark read |
| `/officer` | officer, admin | queue, stats, grievance detail, review, status, notes, reassign, escalate, unlink duplicate |
| `/admin` | admin | categories, departments, officers, datasets, webhooks, jobs (sla-scan, auto-close), audit |
| `/analytics` | admin | overview, departments, trends, categories, sla, recurrence, bottlenecks, agents |
| `/observability` | admin | traces, trace detail, share/unshare, errors |
| `/public/traces/{token}` | public | redacted shared trace |

---

## Testing

```bash
cd backend && python -m pytest -q
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

Backend tests run on a throw-away SQLite database with **no LLM keys** (fallback mode) and the hashing embedder.
The 12 mandatory scenarios map to:

| # | Scenario | Test |
|---|----------|------|
| 1 | Citizen submits and confirms | `test_citizen_flow.py::test_citizen_submits_and_confirms_grievance`, `test_submission_requires_explicit_confirmation` |
| 2 | Citizen tracks a grievance | `test_citizen_flow.py::test_citizen_tracks_individual_grievance` |
| 3 | Sensitive → human review | `test_policy.py::test_sensitive_grievance_goes_to_human_review` |
| 4 | Sensitive never auto-closed | `test_policy.py::test_sensitive_grievance_cannot_be_auto_closed` |
| 5 | Low confidence → review | `test_policy.py::test_low_confidence_classification_triggers_review` |
| 6 | Duplicates preserve records | `test_agents.py::test_duplicate_detection_preserves_individual_records` |
| 7 | RAG retrieves relevant examples | `test_agents.py::test_rag_retrieves_relevant_examples` |
| 8 | SLA warnings generated | `test_agents.py::test_sla_warnings_are_generated` |
| 9 | Dispute reopens | `test_citizen_flow.py::test_disputed_resolution_reopens_grievance` |
| 10 | Unauthorized access blocked | `test_security.py` (anonymous, citizen, cross-department, other citizen) |
| 11 | AI actions audited | `test_agents.py::test_ai_actions_generate_complete_audit_events` |
| 12 | Missing credentials → fallback | `test_llm_fallback.py` (also Groq→Gemini fallback and invalid LLM output) |

Frontend tests (Vitest + Testing Library) cover the API client, role guards, SLA/status components and the
analyse → review → explicit-confirm intake flow.

---

## Demo workflow
1. **Landing page** — capability badges show the live LLM chain, embedding model and voice availability.
2. **Citizen** (`citizen@example.org`) → *File a grievance* → switch language to हिंदी or मराठी → type or speak
   *"Ganesh Peth में पिछले 4 दिनों से सीवर का पानी सड़क पर बह रहा है"* → *Analyse* → review category, ward, urgency,
   department, confidence → tick confirmation → *Confirm and submit* → grievance ID + tracking timeline.
3. **Duplicate** — as `citizen2@example.org`, file the same problem in English; the officer view shows both linked
   (cross-lingual), each with its own ID and timeline.
4. **Sensitive case** — file *"A group of men harass women near the bus stop at Ambedkar Nagar every evening"* →
   goes to *Under review*, identity hidden. Sign in as `officer.safety@example.org` → *Human review* → approve & assign.
5. **Officer** (`officer.water@example.org`) → queue → open a case → AI summary, policy decision with policy refs,
   precedents, linked reports, SLA prediction → *Start work* → *Resolve* with a resolution summary.
6. **Citizen** confirms with a rating — or disputes, which reopens the grievance (second dispute escalates).
7. **Admin** (`admin@example.org`) → *Overview* (live figures), *SLA & insights* → *Run SLA scan now* →
   *Run auto-close* (sensitive cases are skipped by policy) → *Category Master* → *Datasets* (dry-run an import) →
   *Audit log* (filter `AI_SYSTEM`) → *Observability* → open the pipeline trace → *Create public link*.

---

## Known limitations
- All datasets are **SYNTHETIC** until the official HackFusion files are imported; accuracy and SLA figures are demo
  estimates, not real-world measurements.
- Without Groq/Gemini keys, intake uses the rule engine: robust for clear complaints, deliberately conservative
  (more cases go to human review) for vague ones.
- The hashing embedder (used when the ML extras are not installed) is language-bound; install
  `requirements-ml.txt` for cross-lingual retrieval and duplicate detection.
- SMS/e-mail channels are recorded as in-app notifications only; webhooks are the integration point for real
  gateways.
- The rate limiter is in-process (single instance); use a shared store for horizontal scaling.
