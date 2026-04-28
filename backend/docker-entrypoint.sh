#!/bin/sh
set -eu

echo "[suitcase] alembic upgrade head..."
alembic -c /app/alembic.ini upgrade head
echo "[suitcase] starting: $*"
exec "$@"
