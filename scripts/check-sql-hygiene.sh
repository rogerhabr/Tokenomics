#!/usr/bin/env bash
# ============================================================================
# check-sql-hygiene.sh — static checks that encode FMEA mitigations the test
# suite cannot reach, because they are about code that does not exist yet.
#
#   F-01 mitigation 3: the Supabase service-role key bypasses RLS entirely.
#                      Exactly one module may hold it. A grep is the only thing
#                      that stops the next well-meaning commit from widening
#                      that, and it will be a commit that WORKS -- it just
#                      returns more rows than it should.
#   F-12:              no bare sum() over a money column; use money_sum().
#   I-11:              nothing under engine/ may reach an AI SDK, the network,
#                      or an ambient clock.
#
# Run standalone or from CI. Exits non-zero on any violation.
# ============================================================================
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
fail=0

say()  { printf '%-58s %s\n' "$1" "$2"; }
bad()  { echo "    $1"; fail=1; }

# ---------------------------------------------------------------- F-01
ALLOWED_SERVICE_ROLE_PATH='src/lib/consulting/privileged/'
hits=$(grep -rniE 'SUPABASE_SERVICE_ROLE|service_role_key|serviceRoleKey' \
         --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
         src scripts 2>/dev/null \
       | grep -v "$ALLOWED_SERVICE_ROLE_PATH" || true)
if [ -n "$hits" ]; then
  say "F-01 service-role key confinement" "FAIL"
  echo "$hits" | while read -r l; do bad "$l"; done
  bad "the service-role key bypasses RLS; it may only live under $ALLOWED_SERVICE_ROLE_PATH"
else
  say "F-01 service-role key confinement" "ok"
fi

# ---------------------------------------------------------------- F-12
# Bare sum() over a column whose name says it is money. Deliberately narrow:
# a name-based heuristic that is easy to read and easy to extend.
money_re='sum[[:space:]]*\([[:space:]]*(cs\.|s\.|e\.|a\.|r\.|x\.|[a-z_]+\.)?(amount|planned_amount|cost|cost_rate|contract_value|bac|eac|etc|pv|ev|ac|revenue_cum|revenue_period|invoiced_cum|wip_amount|deferred_amount|loss_provision|expected_loss|margin_at_risk|labour_amount|expense_amount|budget_amount|delta_cost|estimated_value|estimated_cost)[[:space:]]*\)'
# `grep -v '^[^:]*:[0-9]*: *--'` drops lines that are pure SQL comments. Without
# it the check flags its own documentation: the paragraph above describes the
# anti-pattern using the anti-pattern's own syntax.
hits=$(grep -rniE "$money_re" supabase/migrations 2>/dev/null \
       | grep -vE '^[^:]*:[0-9]+:[[:space:]]*--' \
       | grep -viE 'money_sum|allow-bare-sum' || true)
if [ -n "$hits" ]; then
  say "F-12 no bare sum() over money columns" "FAIL"
  echo "$hits" | while read -r l; do bad "$l"; done
  bad "use consulting.money_sum(amount, currency[, fx_rate_version_id])"
else
  say "F-12 no bare sum() over money columns" "ok"
fi

# ---------------------------------------------------------------- I-11
ENGINE_DIR='src/lib/consulting/engine'
if [ -d "$ENGINE_DIR" ]; then
  hits=$(grep -rnE "from ['\"]@anthropic-ai|from ['\"]openai|\bfetch\(|Date\.now\(\)|Math\.random\(\)|new Date\(\)" \
           --include='*.ts' "$ENGINE_DIR" 2>/dev/null \
         | grep -v '// *injected' || true)
  if [ -n "$hits" ]; then
    say "I-11 calculation engine is pure" "FAIL"
    echo "$hits" | while read -r l; do bad "$l"; done
    bad "time and randomness are injected parameters; no model client, no network"
  else
    say "I-11 calculation engine is pure" "ok"
  fi
else
  say "I-11 calculation engine is pure" "skipped (Stage 2)"
fi

# ---------------------------------------------------------------- RLS
# Every CREATE TABLE in the consulting schema must be followed by an
# ENABLE ROW LEVEL SECURITY for the same table somewhere in the migrations.
tables=$(grep -rhoE 'create table consulting\.[a-z_]+' supabase/migrations \
         | sed 's/.*consulting\.//' | sort -u)
missing=''
for t in $tables; do
  grep -rqE "alter table consulting\.$t enable row level security" supabase/migrations \
    || missing="$missing $t"
done
if [ -n "$missing" ]; then
  say "RLS enabled on every consulting table" "FAIL"
  for t in $missing; do bad "no ENABLE ROW LEVEL SECURITY for consulting.$t"; done
else
  say "RLS enabled on every consulting table" "ok"
fi

echo
[ "$fail" = "0" ] && echo "SQL hygiene checks passed" || echo "SQL hygiene checks FAILED"
exit $fail
