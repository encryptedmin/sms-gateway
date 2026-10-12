#!/bin/sh
set -e

# First start: seed the volume with the bundled database, if there is one.
if [ -n "$DJANGO_DB_PATH" ] && [ ! -f "$DJANGO_DB_PATH" ]; then
    mkdir -p "$(dirname "$DJANGO_DB_PATH")"
    if [ -f /app/db.sqlite3 ]; then
        cp /app/db.sqlite3 "$DJANGO_DB_PATH"
    fi
fi

# Only the web container migrates; the worker must not race it.
if [ "$RUN_MIGRATIONS" = "1" ]; then
    python manage.py migrate --noinput
fi

# Idempotent demo data, including the admin/admin superuser.
if [ "$SEED_DATA" = "1" ]; then
    python manage.py seed_data
fi

exec "$@"
