"""Command-line utilities.

    python -m app.cli init                 # migrate + seed SYNTHETIC data + demo users
    python -m app.cli migrate              # alembic upgrade head
    python -m app.cli import <kind> <file> [--official] [--dry-run] [--replace]
    python -m app.cli sla-scan             # run the SLA monitor once
    python -m app.cli auto-close           # close eligible RESOLVED grievances (never sensitive ones)
    python -m app.cli reembed              # recompute embeddings after changing EMBEDDING_PROVIDER
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from app.core.config import BACKEND_DIR
from app.db.session import SessionLocal, get_engine


def migrate() -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    init = sub.add_parser("init")
    init.add_argument("--no-demo-grievances", action="store_true")
    imp = sub.add_parser("import")
    imp.add_argument("kind", choices=["departments", "categories", "officers", "grievance_history"])
    imp.add_argument("file", type=Path)
    imp.add_argument("--official", action="store_true", help="tag rows as OFFICIAL (default SYNTHETIC)")
    imp.add_argument("--dry-run", action="store_true")
    imp.add_argument("--replace", action="store_true", help="allow overwriting rows from another data source")
    sub.add_parser("sla-scan")
    sub.add_parser("auto-close")
    sub.add_parser("reembed")
    args = p.parse_args(argv)

    get_engine()
    if args.cmd == "migrate":
        migrate()
        print("Database migrated.")
        return
    if args.cmd == "init":
        migrate()
        from app.services.seed import run_seed

        with SessionLocal() as db:
            print(json.dumps(run_seed(db, with_demo_grievances=not args.no_demo_grievances), indent=2))
        return

    with SessionLocal() as db:
        if args.cmd == "import":
            from app.services.importer import import_file

            rep = import_file(db, args.kind, args.file, data_source="OFFICIAL" if args.official else "SYNTHETIC",
                              imported_by="cli", dry_run=args.dry_run, replace_other_sources=args.replace)
            print(json.dumps({"kind": rep.kind, "total": rep.total, "created": rep.created, "updated": rep.updated,
                              "skipped": rep.skipped, "errors": rep.errors[:20], "unmapped_columns": rep.unmapped_columns},
                             indent=2, ensure_ascii=False))
        elif args.cmd == "sla-scan":
            from app.agents.orchestrator import sla_scan

            print(json.dumps(sla_scan(db), indent=2))
        elif args.cmd == "auto-close":
            from app.agents.orchestrator import auto_close

            print(json.dumps(auto_close(db), indent=2))
        elif args.cmd == "reembed":
            from app.services.importer import reembed_all

            print(f"Re-embedded {reembed_all(db)} grievances.")


if __name__ == "__main__":
    main()
