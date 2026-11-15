FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    CHRONOSPECTRA_AUTH_DB=/var/data/chronospectra.sqlite3 \
    CHRONOSPECTRA_ZARR_ROOT=/var/data/processed/zarr

WORKDIR /app

RUN addgroup --system chronospectra \
    && adduser --system --ingroup chronospectra chronospectra \
    && mkdir -p /var/data \
    && chown chronospectra:chronospectra /var/data

COPY backend/requirements-api.txt /app/requirements-api.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r /app/requirements-api.txt

COPY --chown=chronospectra:chronospectra backend /app/backend

RUN python /app/backend/src/mock_qr3_generator.py \
        --output-dir /opt/chronospectra-demo-zarr \
    && chown -R chronospectra:chronospectra /opt/chronospectra-demo-zarr \
    && install -o chronospectra -g chronospectra -m 0755 \
        /app/backend/docker-entrypoint.sh /usr/local/bin/chronospectra-entrypoint

USER chronospectra

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/chronospectra-entrypoint"]
