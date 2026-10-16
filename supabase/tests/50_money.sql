-- ============================================================================
-- PROOF 50 — Money arithmetic (invariant I-14 as restated, FMEA F-12)
--
-- The claim being proved is the restated, enforceable one: mixed-currency
-- aggregation RAISES rather than silently returning a number that is wrong by
-- the FX spread, and a closed period's rates cannot move.
-- ============================================================================
\set ON_ERROR_STOP off

create or replace function test.check(p_label text, p_ok boolean)
returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PROOF PASS  %', p_label;
  else         raise notice 'PROOF FAIL  %', p_label;
  end if;
end $$;

create or replace function test.why(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

do $$
declare
  f uuid := 'f5000000-0000-0000-0000-000000000001';
  v_fx uuid; v_idfx uuid; m text; v numeric;
begin
  insert into consulting.firm (id, name, base_currency) values (f, 'FX Test Firm', 'USD');

  insert into consulting.fx_rate_version (firm_id, as_of, base_currency, rates, source)
  values (f, date '2026-01-31', 'USD',
          '{"EUR": 0.92, "GBP": 0.79}'::jsonb, 'proof fixture')
  returning id into v_fx;

  -- ---------------------------------------------------------------- 50.1
  -- The whole point: a bare cross-currency total looks exactly like a correct
  -- number. money_sum refuses instead.
  m := test.why($q$select consulting.money_sum(x.amt, x.cur)
                     from (values (100::numeric,'USD'::consulting.currency_code),
                                  (100::numeric,'EUR'::consulting.currency_code))
                          as x(amt,cur)$q$);
  perform test.check('50.1a summing USD and EUR without an fx version refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%refusing to sum%');

  select consulting.money_sum(x.amt, x.cur) into v
    from (values (100::numeric,'USD'::consulting.currency_code),
                 (250::numeric,'USD'::consulting.currency_code))
         as x(amt,cur);
  perform test.check('50.1b CONTROL: single-currency sum works ['||v||']', v = 350);

  -- ---------------------------------------------------------------- 50.2
  -- With an explicit rate version the conversion is allowed, recorded and
  -- reproducible. 100 EUR / 0.92 = 108.6957 USD.
  select consulting.money_sum(x.amt, x.cur, v_fx) into v
    from (values (100::numeric,'USD'::consulting.currency_code),
                 (100::numeric,'EUR'::consulting.currency_code))
         as x(amt,cur);
  perform test.check('50.2a with an fx version the cross-currency sum converts ['||v||']',
                     v between 208.69 and 208.70);

  v := consulting.convert_money(100, 'EUR', 'GBP', v_fx);
  perform test.check('50.2b cross-rate EUR->GBP via the base currency ['||v||']',
                     v between 85.86 and 85.88);

  v := consulting.convert_money(100, 'USD', 'USD', v_fx);
  perform test.check('50.2c same-currency conversion is a no-op ['||v||']', v = 100);

  -- ---------------------------------------------------------------- 50.3
  m := test.why($q$select consulting.convert_money(100,'EUR','USD',null)$q$);
  perform test.check('50.3a conversion with no fx version refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%requires an explicit fx_rate_version%');

  m := test.why(format($q$select consulting.convert_money(100,'JPY','USD',%L)$q$, v_fx));
  perform test.check('50.3b conversion with a missing rate refused, not defaulted to 1 ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%has no rate for%');

  -- ---------------------------------------------------------------- 50.4
  -- A closed period's rates must not move, or a closed month's margin moves
  -- with them.
  update consulting.fx_rate_version set locked_at = now() where id = v_fx;
  m := test.why(format($q$update consulting.fx_rate_version
        set rates = '{"EUR":0.5}'::jsonb where id = %L$q$, v_fx));
  perform test.check('50.4a a locked fx version''s rates cannot change ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%is locked%');

  -- Non-rate metadata may still be annotated.
  m := test.why(format($q$update consulting.fx_rate_version
        set source = 'ECB daily, reconciled' where id = %L$q$, v_fx));
  perform test.check('50.4b ... but its provenance note can still be corrected ['
                     ||coalesce(m,'ok')||']', m is null);

  -- ---------------------------------------------------------------- 50.5
  -- DR-08: the identity fx version carries only the base currency, so a stray
  -- conversion raises instead of silently passing the amount through at 1:1.
  --
  -- The seed and the conversion MUST be separate statements. Written as
  --   convert_money(100,'EUR','USD', seed_identity_fx(f))
  -- the call fails with "fx_rate_version not found": convert_money is STABLE,
  -- so it reads the snapshot of the calling statement, which was taken before
  -- the insert performed while evaluating its own argument. A volatile write
  -- nested inside a stable read in one statement is invisible to that read.
  select consulting.seed_identity_fx(f) into v_idfx;
  perform test.check('50.5a the identity fx version is created', v_idfx is not null);

  m := test.why(format($q$select consulting.convert_money(100,'EUR','USD',%L)$q$, v_idfx));
  perform test.check('50.5b a foreign conversion against the identity version raises '
                     ||'rather than passing through at 1:1 ['||coalesce(m,'ALLOWED')||']',
                     m like '%has no rate for%');

  v := consulting.convert_money(100, 'USD', 'USD', v_idfx);
  perform test.check('50.5c CONTROL: the base currency still converts to itself ['||v||']',
                     v = 100);
end $$;
