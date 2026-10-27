# syntax=docker/dockerfile:1
# The workbench image: the React UI built with Vite, served by the backend-for-frontend (FastAPI) with its /api.
FROM public.ecr.aws/docker/library/node:20-slim AS ui
WORKDIR /ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ui/ ./
RUN npm run build

FROM public.ecr.aws/docker/library/python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 UI_DIST=/app/ui
WORKDIR /app
COPY bff/pyproject.toml ./
COPY bff/src ./src
RUN --mount=type=bind,from=wheels,target=/wheels \
    --mount=type=secret,id=pip_index_url \
    if [ -s /run/secrets/pip_index_url ]; then export PIP_INDEX_URL="$(cat /run/secrets/pip_index_url)"; fi; \
    pip install --find-links /wheels . && rm -rf src
COPY --from=ui /ui/dist /app/ui
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app
USER 10001
EXPOSE 8000
CMD ["uvicorn", "ptap_bff.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
