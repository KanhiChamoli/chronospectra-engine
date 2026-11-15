#!/bin/sh
set -eu

zarr_root="${CHRONOSPECTRA_ZARR_ROOT:-/var/data/processed/zarr}"
mkdir -p "$zarr_root"

if [ -z "$(find "$zarr_root" -type f -name .zgroup -print -quit)" ]; then
    cp -R /opt/chronospectra-demo-zarr/. "$zarr_root/"
    printf '%s\n' "Initialized empty Zarr storage with clearly labeled synthetic demo products."
fi

exec uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers
