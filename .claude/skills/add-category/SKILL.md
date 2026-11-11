---
name: add-category
description: Add or change a grievance category in the Category Master (department, SLA, sensitivity, threshold, keywords).
---

1. SYNTHETIC demo data: edit `CATEGORIES` in `backend/scripts/generate_synthetic_data.py` (plus templates and resolutions), run it, then `python -m app.cli import categories data/synthetic/categories.csv`.
2. OFFICIAL data: import through Admin -> Datasets (dry run first).
3. Sensitive categories always get `hide_identity=true` and `auto_close_allowed=false` (enforced by the importer and admin API).
4. Add keywords in English, Hindi and Marathi, then run `pytest tests/test_policy.py tests/test_citizen_flow.py`.
