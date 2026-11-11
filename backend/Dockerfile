# GRIEVANCE backend — FastAPI + SQLAlchemy + Alembic
FROM python:3.11-slim

ARG INSTALL_ML=false
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-ml.txt ./
RUN pip install -r requirements.txt \
 && if [ "$INSTALL_ML" = "true" ]; then \
      pip install --index-url https://download.pytorch.org/whl/cpu torch && pip install -r requirements-ml.txt; \
    fi

COPY . .

RUN useradd --create-home --uid 10001 app && mkdir -p /app/uploads && chown -R app:app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 CMD curl -fs http://localhost:8000/health || exit 1

# Migrate + seed (idempotent), then serve.
CMD ["sh", "-c", "python -m app.cli init && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
