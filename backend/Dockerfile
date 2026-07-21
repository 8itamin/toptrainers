# syntax=docker/dockerfile:1
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/home/appuser/.local/bin:${PATH}"

RUN groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid appuser --create-home --shell /usr/sbin/nologin appuser

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --upgrade pip \
    && pip install .

COPY alembic.ini ./
COPY migrations ./migrations

USER appuser
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "toptrainers_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
