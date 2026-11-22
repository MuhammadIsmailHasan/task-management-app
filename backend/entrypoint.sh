#!/bin/sh
set -e
# A rollback sets SKIP_MIGRATIONS=1: an older image does not know a newer Alembic revision.
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  flask db upgrade
fi
exec "$@"
