# Data & secrets

- Official HackFusion datasets are not yet available. `backend/data/synthetic/` is generated and stays labelled SYNTHETIC.
- Real datasets go through `services/importer.py` (Admin → Datasets or `python -m app.cli import`) using
  `backend/data/schemas/*.json`. They are tagged OFFICIAL and never silently overwrite other sources.
- Secrets only via environment (`backend/app/core/config.py`). Frontend env holds `VITE_*` public values only.
- Never paste real citizen data into prompts, tests, traces, fixtures or commit messages.
