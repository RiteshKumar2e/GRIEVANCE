"""Portable column types.

`EmbeddingVector` is a pgvector `vector(n)` on PostgreSQL and a JSON array elsewhere,
so the same models and migrations run against Postgres in production and SQLite in tests.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import JSON, Text
from sqlalchemy.types import TypeDecorator


class EmbeddingVector(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, dim: int = 384, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        values = [float(x) for x in value]
        if dialect.name == "postgresql":
            return values
        return json.dumps(values)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return json.loads(value)
        return [float(x) for x in value]


JSONType = JSON
