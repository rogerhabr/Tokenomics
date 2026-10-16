-- ============================================================================
-- 0013 — Money arithmetic (invariant I-14, FMEA F-12)
--
-- An honest statement of what is and is not enforceable.
--
-- I-14 was written as "money columns never sum without an explicit currency +
-- fx_rate_version". A CHECK constraint cannot deliver that: constraints see one
-- row, and `select sum(amount) from ...` across mixed currencies is a perfectly
-- valid query no constraint can intercept. Claiming otherwise would be a
-- governance invariant that does not exist.
--
-- What IS enforceable, and is built here:
--
--   1. consulting.money_sum(amount, currency)        -- raises on mixed input
--   2. consulting.money_sum(amount, currency, fx_id) -- converts, then sums
--   3. consulting.convert_money(...)                 -- single conversion, with
--      a locked rate version, so a closed period's margin can never move
--   4. every barrier view and every roll-up uses (1) or (2), never bare sum()
--   5. a CI check (scripts/check-sql-hygiene.sh) that fails the build on a bare
--      sum() over a money column in migrations or views
--
-- So the real invariant is: "no money aggregate in this codebase uses bare
-- sum(); mixed-currency aggregation raises rather than silently producing a
-- number that is wrong by the FX spread." That is testable, and proof 50 tests
-- it. The weaker claim replaces the stronger one in the docs.
-- ============================================================================

-- ---------------------------------------------------------------- conversion
create or replace function consulting.convert_money(
  p_amount           numeric,
  p_from             consulting.currency_code,
  p_to               consulting.currency_code,
  p_fx_rate_version_id uuid
) returns numeric
language plpgsql
stable
as $$
declare
  v_base  consulting.currency_code;
  v_rates jsonb;
  v_from_rate numeric;
  v_to_rate   numeric;
begin
  if p_amount is null then return null; end if;
  if p_from = p_to then return p_amount; end if;

  if p_fx_rate_version_id is null then
    raise exception
      'converting % -> % requires an explicit fx_rate_version', p_from, p_to
      using errcode = '22023', hint = 'Invariant I-14 / FMEA F-12';
  end if;

  select base_currency, rates into v_base, v_rates
    from consulting.fx_rate_version where id = p_fx_rate_version_id;

  if v_base is null then
    raise exception 'fx_rate_version % not found', p_fx_rate_version_id
      using errcode = 'P0002';
  end if;

  -- rates are expressed per unit of base_currency
  v_from_rate := case when p_from = v_base then 1
                      else (v_rates->>p_from::text)::numeric end;
  v_to_rate   := case when p_to   = v_base then 1
                      else (v_rates->>p_to::text)::numeric end;

  if v_from_rate is null then
    raise exception 'fx_rate_version % has no rate for %', p_fx_rate_version_id, p_from
      using errcode = '22023';
  end if;
  if v_to_rate is null then
    raise exception 'fx_rate_version % has no rate for %', p_fx_rate_version_id, p_to
      using errcode = '22023';
  end if;

  return round(p_amount / v_from_rate * v_to_rate, 4);
end $$;

-- ---------------------------------------------------------------- aggregates
-- Two-arg form: refuses mixed currencies outright. This is the one to reach for
-- by default, because a total that silently spans currencies is wrong by the
-- spread and looks exactly like a correct number.
create type consulting.money_acc as (
  total     numeric,
  currency  consulting.currency_code,
  fx_id     uuid
);

create or replace function consulting.money_sum_sfunc(
  acc consulting.money_acc, p_amount numeric, p_currency consulting.currency_code
) returns consulting.money_acc
language plpgsql immutable
as $$
begin
  if p_amount is null then return acc; end if;
  if acc.currency is null then
    return (p_amount, p_currency, null)::consulting.money_acc;
  end if;
  if acc.currency <> p_currency then
    raise exception
      'refusing to sum % and % without an fx_rate_version', acc.currency, p_currency
      using errcode = '22023',
            hint = 'Use the 3-argument money_sum(amount, currency, fx_rate_version_id).';
  end if;
  return (acc.total + p_amount, acc.currency, null)::consulting.money_acc;
end $$;

create or replace function consulting.money_sum_ffunc(acc consulting.money_acc)
returns numeric language sql immutable as $$ select acc.total $$;

create aggregate consulting.money_sum(numeric, consulting.currency_code) (
  sfunc     = consulting.money_sum_sfunc,
  stype     = consulting.money_acc,
  finalfunc = consulting.money_sum_ffunc,
  initcond  = '(,,)'
);

-- Three-arg form: converts every element into the fx version's base currency,
-- then sums. The conversion is explicit and the rate version is recorded, so
-- the result is reproducible.
create or replace function consulting.money_sum_fx_sfunc(
  acc consulting.money_acc, p_amount numeric,
  p_currency consulting.currency_code, p_fx_id uuid
) returns consulting.money_acc
language plpgsql stable
as $$
declare v_base consulting.currency_code;
begin
  if p_amount is null then return acc; end if;
  select base_currency into v_base from consulting.fx_rate_version where id = p_fx_id;
  if v_base is null then
    raise exception 'fx_rate_version % not found', p_fx_id using errcode = 'P0002';
  end if;
  return (
    coalesce(acc.total, 0) + consulting.convert_money(p_amount, p_currency, v_base, p_fx_id),
    v_base, p_fx_id
  )::consulting.money_acc;
end $$;

create aggregate consulting.money_sum(numeric, consulting.currency_code, uuid) (
  sfunc     = consulting.money_sum_fx_sfunc,
  stype     = consulting.money_acc,
  finalfunc = consulting.money_sum_ffunc,
  initcond  = '(,,)'
);

comment on aggregate consulting.money_sum(numeric, consulting.currency_code) is
  'Sums money, raising on mixed currencies. FMEA F-12: a cross-currency total '
  'produced by bare sum() is wrong by the FX spread and indistinguishable from '
  'a correct one.';

-- ---------------------------------------------------------------- period lock
-- Once a period closes its rate is frozen, so a closed month's margin can never
-- move. A locked version is immutable.
create or replace function consulting.guard_fx_version_locked()
returns trigger language plpgsql as $$
begin
  if old.locked_at is not null then
    if new.rates is distinct from old.rates
       or new.base_currency is distinct from old.base_currency
       or new.as_of is distinct from old.as_of then
      raise exception 'fx_rate_version % is locked; a closed period''s rates cannot move',
        old.id using errcode = '42501', hint = 'FMEA F-12';
    end if;
  end if;
  return new;
end $$;

create trigger guard_fx_version_locked
  before update on consulting.fx_rate_version
  for each row execute function consulting.guard_fx_version_locked();

-- ---------------------------------------------------------------- identity FX
-- DR-08: single currency at launch. Seed an identity rate version per firm so
-- the three-argument form works from day one and switching multi-currency on
-- later needs no migration.
create or replace function consulting.seed_identity_fx(p_firm_id uuid)
returns uuid
language plpgsql
as $$
declare v_base consulting.currency_code; v_id uuid;
begin
  select base_currency into v_base from consulting.firm where id = p_firm_id;
  insert into consulting.fx_rate_version (firm_id, as_of, base_currency, rates, source)
  values (p_firm_id, current_date, v_base,
          jsonb_build_object(v_base::text, 1), 'identity (single-currency launch, DR-08)')
  on conflict (firm_id, as_of, base_currency) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from consulting.fx_rate_version
     where firm_id = p_firm_id and as_of = current_date and base_currency = v_base;
  end if;
  return v_id;
end $$;

-- Fold it into firm provisioning.
create or replace function consulting.seed_firm_money(p_firm_id uuid)
returns void language sql as $$
  select consulting.seed_identity_fx(p_firm_id); select null::void;
$$;

grant execute on function consulting.convert_money(numeric, consulting.currency_code,
  consulting.currency_code, uuid) to authenticated;
grant execute on function consulting.seed_identity_fx(uuid) to authenticated;
