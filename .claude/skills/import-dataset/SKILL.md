---
name: import-dataset
description: Import the official HackFusion Category Master, Department Directory or Grievance History once available.
---

1. Put the file in `backend/data/raw/` (git-ignored). Never paste rows into chat or prompts.
2. Compare its headers with `backend/data/schemas/<kind>.json`; add aliases there if names differ.
3. Dry run: `python -m app.cli import <kind> data/raw/<file> --official --dry-run`.
4. Import in order departments -> categories -> officers -> grievance_history. Use `--replace` only when the user explicitly wants SYNTHETIC rows replaced.
5. Run `python -m app.cli reembed` after importing history, then the run-checks skill.
