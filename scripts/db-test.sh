#!/usr/bin/env bash
# ============================================================================
# db-test.sh — boot a throwaway Postgres 16 cluster, apply every migration from
# scratch, then run the acceptance proofs in supabase/tests/.
#
# This is how the Stage 1 gate conditions in docs/consulting/05-BUILD-STAGES.md
# are verified. It rebuilds from zero every run, so a passing result cannot be an
# artefact of leftover state.
#
#   ./scripts/db-test.sh              # migrations + all tests
#   ./scripts/db-test.sh --migrate    # migrations only
#   ./scripts/db-test.sh --keep       # leave the cluster running afterwards
# ============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="${PGTEST_DIR:-${TMPDIR:-/tmp}/atlas-pgtest}"
PGDATA="$WORK/pgdata"
SOCK="$WORK/sock"
PORT="${PGTEST_PORT:-5433}"
DB=atlas_test
MIGRATE_ONLY=0
KEEP=0

for a in "$@"; do
  case "$a" in
    --migrate) MIGRATE_ONLY=1 ;;
    --keep)    KEEP=1 ;;
    *) echo "unknown flag: $a" >&2; exit 64 ;;
  esac
done

# initdb refuses to run as root, so fall back to the postgres system user.
RUNAS=""
if [ "$(id -u)" = "0" ]; then
  id -u postgres >/dev/null 2>&1 || { echo "need a 'postgres' system user when running as root" >&2; exit 1; }
  RUNAS="postgres"
fi
run_pg() { if [ -n "$RUNAS" ]; then su "$RUNAS" -s /bin/bash -c "$1"; else bash -c "$1"; fi; }

cleanup() {
  [ "$KEEP" = "1" ] && { echo "cluster left running on $SOCK:$PORT"; return; }
  run_pg "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> fresh cluster in $WORK"
run_pg "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
rm -rf "$WORK"; mkdir -p "$PGDATA" "$SOCK"
# the postgres user must be able to traverse every parent directory
d="$WORK"; while [ "$d" != "/" ]; do chmod o+x "$d" 2>/dev/null || true; d="$(dirname "$d")"; done
[ -n "$RUNAS" ] && chown -R "$RUNAS" "$WORK"

run_pg "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
run_pg "$PGBIN/pg_ctl -D $PGDATA -l $WORK/pg.log -o '-p $PORT -k $SOCK' -w start" >/dev/null

PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -X -q"
$PSQL -d postgres -c "create database $DB;" >/dev/null

echo "==> supabase shim (local only; Supabase provides this natively)"
$PSQL -d "$DB" -f "$REPO/supabase/tests/00_local_shim.sql" 2>&1 | grep -v '^NOTICE' || true

echo "==> migrations"
for f in "$REPO"/supabase/migrations/*.sql; do
  printf '    %-52s' "$(basename "$f")"
  if out=$($PSQL -d "$DB" -f "$f" 2>&1); then
    echo "ok"
  else
    echo "FAILED"; echo "$out" | grep -v '^NOTICE' | head -20; exit 1
  fi
done

if [ "$MIGRATE_ONLY" = "1" ]; then echo "==> migrations only, done"; exit 0; fi

echo "==> acceptance proofs"
fail=0
shopt -s nullglob
for f in "$REPO"/supabase/tests/[1-9]*.sql; do
  echo "--- $(basename "$f")"
  if out=$(psql -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -X -q -f "$f" 2>&1); then
    echo "$out" | grep -vE '^\s*$|^NOTICE' || true
  else
    echo "$out" | grep -vE '^\s*$' | head -40; fail=1
  fi
  if echo "$out" | grep -q 'PROOF FAIL'; then fail=1; fi
done

echo
if [ "$fail" = "0" ]; then echo "ALL PROOFS PASSED"; else echo "PROOFS FAILED"; exit 1; fi
