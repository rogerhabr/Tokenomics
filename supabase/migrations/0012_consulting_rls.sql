-- ============================================================================
-- 0012 — Row-level security, barrier views and the conflict wall
--
-- Invariant I-13. The threat model is NOT cross-tenant: one firm usually owns
-- the whole instance. It is cross-ENGAGEMENT inside one firm -- the team on
-- Client A's transaction seeing Client B's. Tenant-level RLS does nothing about
-- that, which is why `engagement_member` and not `firm_id` is the boundary.
--
-- Three things make this hard, and all three are addressed here:
--
--  1. Nested tables. baseline_activity has no project_id; test_case has no
--     project_id. A policy that only covers tables with a convenient column
--     leaves the children wide open.
--
--  2. Aggregates (FMEA F-11, RPN 75). Row policies can be perfect while a
--     firm-wide utilisation heatmap still reveals that four named architects
--     are fully committed in March -- on something. In a small practice that IS
--     the leak. So aggregates go through `security_barrier` views with a
--     k-anonymity floor, and person-level capacity is not firm-readable.
--
--  3. Recursion. Every policy calls a SECURITY DEFINER helper, which runs as
--     the table owner and therefore bypasses RLS on the tables it inspects.
--     A policy on engagement_member that queried engagement_member through RLS
--     would recurse; these do not.
--
-- DR confirmed by the user: NOBODY is exempt from the conflict wall. A Director
-- staffed on Client A cannot see Client B in the same conflict group without a
-- logged conflict_waiver. `can_see_engagement()` from 0003 already applies
-- `conflict_blocked()` ahead of the firm-role check, so firm roles widen reach
-- across clients but never across the wall.
-- ============================================================================

-- ============================================================================
-- Resolver helpers
-- ============================================================================

create or replace function consulting.can_see_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select consulting.can_see_engagement(
           (select engagement_id from consulting.project where id = p_project_id));
$$;

-- A client is visible if any of its engagements is, or if the caller holds a
-- firm role AND is not walled off from the client's conflict group. Checked
-- against every engagement of that client so an unstaffed client is still
-- walled when its group is live for this caller.
create or replace function consulting.can_see_client(p_client_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select exists (
    select 1 from consulting.engagement e
     where e.client_id = p_client_id
       and consulting.can_see_engagement(e.id)
  )
  or (
    consulting.has_firm_role(array['DIRECTOR','PMO_LEAD','FINANCE_CONTROLLER'])
    -- Same tenant test as can_see_engagement: a firm role is evidence about the
    -- CALLER, never about the target row's firm.
    and exists (
      select 1 from consulting.client c
       where c.id = p_client_id and c.firm_id = consulting.current_firm()
    )
    and not exists (
      -- walled: the caller sits inside a different client of the same group
      select 1
        from consulting.client target
        join consulting.client other
          on other.conflict_group_id = target.conflict_group_id
         and other.id <> target.id
        join consulting.engagement e2 on e2.client_id = other.id
        join consulting.engagement_member em on em.engagement_id = e2.id
        join consulting.app_user me on me.id = em.user_id
       where target.id = p_client_id
         and target.conflict_group_id is not null
         and me.auth_user_id = auth.uid()
         and current_date >= em.from_date
         and (em.to_date is null or current_date <= em.to_date)
         and not exists (
           select 1 from consulting.conflict_waiver w
            where w.user_id = me.id
              and now() between w.valid_from and w.valid_to
              and ((w.client_a_id = target.id and w.client_b_id = other.id)
                or (w.client_b_id = target.id and w.client_a_id = other.id))
         )
    )
  );
$$;

create or replace function consulting.can_see_opportunity(p_opportunity_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select consulting.can_see_client(
           (select client_id from consulting.opportunity where id = p_opportunity_id));
$$;

create or replace function consulting.is_self(p_app_user_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select exists (
    select 1 from consulting.app_user
     where id = p_app_user_id and auth_user_id = auth.uid() and is_active);
$$;

create or replace function consulting.in_my_firm(p_firm_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select p_firm_id = consulting.current_firm();
$$;

-- ============================================================================
-- Policy generator
--
-- One predicate per table, applied as four policies (select/insert/update/
-- delete). Written as a generator rather than ~240 hand-rolled policy
-- statements so that the predicate for each table is auditable at a glance and
-- a table cannot be given a policy for SELECT and quietly left open for INSERT.
-- ============================================================================

do $$
declare
  t record;
  v_pred text;
  v_count int := 0;
begin
  for t in
    select * from (values
      -- ---------- firm-scoped reference data: anyone in the firm may read
      ('firm',                      'consulting.in_my_firm(id)'),
      ('org_unit',                  'consulting.in_my_firm(firm_id)'),
      ('role_def',                  'consulting.in_my_firm(firm_id)'),
      ('role_waiver_domain',        'consulting.in_my_firm(firm_id)'),
      ('skill',                     'consulting.in_my_firm(firm_id)'),
      ('calendar',                  'consulting.in_my_firm(firm_id)'),
      ('calendar_exception',        'consulting.in_my_firm(firm_id)'),
      ('fx_rate_version',           'consulting.in_my_firm(firm_id)'),
      ('conflict_group',            'consulting.in_my_firm(firm_id)'),
      ('phase_def',                 'consulting.in_my_firm(firm_id)'),
      ('gate_def',                  'consulting.in_my_firm(firm_id)'),
      ('gate_criterion',            'consulting.in_my_firm(firm_id)'),
      ('objective',                 'consulting.in_my_firm(firm_id)'),
      ('formula',                   'consulting.in_my_firm(firm_id)'),
      ('formula_version',           'consulting.in_my_firm(firm_id)'),
      ('formula_test_case',         'consulting.in_my_firm(firm_id)'),
      ('formula_binding',           'consulting.in_my_firm(firm_id)'),
      ('formula_change_request',    'consulting.in_my_firm(firm_id)'),
      ('scoring_model',             'consulting.in_my_firm(firm_id)'),
      ('scoring_criterion',         'consulting.in_my_firm(firm_id)'),
      ('checklist_template',        'consulting.in_my_firm(firm_id)'),
      ('checklist_template_item',   'consulting.in_my_firm(firm_id)'),
      ('agent_def',                 'consulting.in_my_firm(firm_id)'),
      ('agent_authority',           'consulting.in_my_firm(firm_id)'),
      ('agent_run',                 'consulting.in_my_firm(firm_id)'),
      ('agent_calibration',         'consulting.in_my_firm(firm_id)'),
      ('ledger_checkpoint',         'consulting.in_my_firm(firm_id)'),
      ('timesheet_period',          'consulting.in_my_firm(firm_id)'),

      -- ---------- identity: yourself, or colleagues in your firm.
      -- Rate cards are the exception: your own, or firm-role holders only.
      -- Salary-equivalent data is not colleague-readable.
      ('app_user',                  'consulting.in_my_firm(firm_id)'),
      ('org_membership',            'consulting.in_my_firm(firm_id)'),
      ('person_skill',              'consulting.in_my_firm(firm_id)'),
      ('rate_card',                 'consulting.is_self(user_id) or consulting.has_firm_role(array[''DIRECTOR'',''PMO_LEAD'',''FINANCE_CONTROLLER''])'),
      -- user_role was missing from an earlier version of this map. RLS was on
      -- and no policy existed, so it denied everything -- safe, but it breaks
      -- the gate console, which must show which role-holders may sign. Found by
      -- the coverage meta-assertion in proof 40.1b, not by a table-specific
      -- test. Visibility: your own grants; a firm governance role; or grants
      -- scoped to something you can already see.
      ('user_role',
       'consulting.is_self(user_id) '
       'or consulting.has_firm_role(array[''DIRECTOR'',''PMO_LEAD'']) '
       'or (scope_kind = ''ENGAGEMENT'' and consulting.can_see_engagement(scope_id)) '
       'or (scope_kind = ''PROJECT''    and consulting.can_see_project(scope_id)) '
       'or (scope_kind = ''CLIENT''     and consulting.can_see_client(scope_id)) '
       'or (scope_kind = ''FIRM''       and consulting.in_my_firm(firm_id))'),
      ('conflict_waiver',           'consulting.is_self(user_id) or consulting.has_firm_role(array[''DIRECTOR'',''PMO_LEAD''])'),
      ('barrier_acknowledgement',   'consulting.is_self(user_id) or consulting.has_firm_role(array[''DIRECTOR'',''PMO_LEAD''])'),

      -- ---------- client / engagement
      ('client',                    'consulting.can_see_client(id)'),
      ('engagement',                'consulting.can_see_engagement(id)'),
      ('engagement_member',         'consulting.can_see_engagement(engagement_id)'),
      ('milestone_invoice',         'consulting.can_see_engagement(engagement_id)'),
      ('revenue_recognition',       'consulting.can_see_engagement(engagement_id)'),

      -- ---------- intake, keyed on the opportunity's client
      ('opportunity',                   'consulting.can_see_client(client_id)'),
      ('opportunity_objective_link',    'consulting.can_see_opportunity(opportunity_id)'),
      ('opportunity_score',             'consulting.can_see_opportunity(opportunity_id)'),
      ('resource_estimate',             'consulting.can_see_opportunity(opportunity_id)'),
      ('intake_feasibility',            'consulting.can_see_opportunity(opportunity_id)'),
      ('conflict_check',                'consulting.can_see_opportunity(opportunity_id)'),

      -- ---------- delivery, keyed on project
      ('project',                   'consulting.can_see_project(id)'),
      ('wbs_node',                  'consulting.can_see_project(project_id)'),
      ('activity',                  'consulting.can_see_project(project_id)'),
      ('dependency',                'consulting.can_see_project(project_id)'),
      ('assignment',                'consulting.can_see_project(project_id)'),
      ('cost_account',              'consulting.can_see_project(project_id)'),
      ('wbs_cost_plan',             'consulting.can_see_project(project_id)'),
      ('baseline',                  'consulting.can_see_project(project_id)'),
      ('change_request',            'consulting.can_see_project(project_id)'),
      ('schedule_health',           'consulting.can_see_project(project_id)'),
      ('timesheet_entry',           'consulting.can_see_project(project_id)'),
      ('expense_entry',             'consulting.can_see_project(project_id)'),
      ('progress_update',           'consulting.can_see_project(project_id)'),
      ('cost_actual',               'consulting.can_see_project(project_id)'),
      ('forecast_version',          'consulting.can_see_project(project_id)'),
      ('evm_snapshot',              'consulting.can_see_project(project_id)'),
      ('test_plan',                 'consulting.can_see_project(project_id)'),
      ('uat_run',                   'consulting.can_see_project(project_id)'),
      ('defect',                    'consulting.can_see_project(project_id)'),
      ('defect_metric',             'consulting.can_see_project(project_id)'),
      ('uat_signoff',               'consulting.can_see_project(project_id)'),
      ('deployment_checklist',      'consulting.can_see_project(project_id)'),
      ('handover_package',          'consulting.can_see_project(project_id)'),
      ('client_signoff',            'consulting.can_see_project(project_id)'),
      ('post_mortem',               'consulting.can_see_project(project_id)'),
      ('gate_instance',             'consulting.can_see_project(project_id)'),

      -- ---------- nested tables with no project_id of their own.
      -- These are where a careless RLS pass leaves the barrier open: the parent
      -- is protected and the child is not.
      ('baseline_activity',  'exists (select 1 from consulting.baseline b where b.id = baseline_id and consulting.can_see_project(b.project_id))'),
      ('baseline_cost',      'exists (select 1 from consulting.baseline b where b.id = baseline_id and consulting.can_see_project(b.project_id))'),
      ('baseline_scope',     'exists (select 1 from consulting.baseline b where b.id = baseline_id and consulting.can_see_project(b.project_id))'),
      ('test_case',          'exists (select 1 from consulting.test_plan tp where tp.id = test_plan_id and consulting.can_see_project(tp.project_id))'),
      ('test_coverage',      'exists (select 1 from consulting.test_plan tp where tp.id = test_plan_id and consulting.can_see_project(tp.project_id))'),
      ('checklist_item',     'exists (select 1 from consulting.deployment_checklist dc where dc.id = checklist_id and consulting.can_see_project(dc.project_id))'),
      ('gate_criterion_result','exists (select 1 from consulting.gate_instance gi where gi.id = gate_instance_id and consulting.can_see_project(gi.project_id))'),
      ('signoff',            'exists (select 1 from consulting.gate_instance gi where gi.id = gate_instance_id and consulting.can_see_project(gi.project_id))'),
      ('gate_waiver',        'exists (select 1 from consulting.gate_instance gi where gi.id = gate_instance_id and consulting.can_see_project(gi.project_id))'),

      -- ---------- agent output, scoped to its engagement
      ('agent_finding',  'engagement_id is null and consulting.in_my_firm(firm_id) or consulting.can_see_engagement(engagement_id)'),
      ('agent_proposal', 'engagement_id is null and consulting.in_my_firm(firm_id) or consulting.can_see_engagement(engagement_id)'),

      -- ---------- FMEA F-11: person-level capacity is NOT colleague-readable.
      -- A row naming a person and a period is enough to infer that they are
      -- committed to something, and in a small practice that is the leak. Only
      -- the person themselves and firm-role holders see person-level rows;
      -- everyone else uses the role-level barrier view below.
      ('capacity_snapshot',
       'consulting.in_my_firm(firm_id) and (user_id is null or consulting.is_self(user_id) '
       'or consulting.has_firm_role(array[''DIRECTOR'',''PMO_LEAD'',''FINANCE_CONTROLLER'']))'),

      -- ---------- firm-level risk output. entities_json may name engagements,
      -- so it is restricted to firm-role holders; the barrier view exposes the
      -- actionable shape to everyone else.
      ('clash',          'consulting.in_my_firm(firm_id) and consulting.has_firm_role(array[''DIRECTOR'',''PMO_LEAD'',''ENGAGEMENT_MANAGER'',''DELIVERY_LEAD''])'),
      ('foresight_run',  'consulting.in_my_firm(firm_id) and (scope_kind <> ''ENGAGEMENT'' or consulting.can_see_engagement(scope_id))')
    ) as t(tbl, pred)
  loop
    v_pred := t.pred;

    execute format('drop policy if exists %I on consulting.%I', t.tbl || '_read', t.tbl);
    execute format('drop policy if exists %I on consulting.%I', t.tbl || '_ins',  t.tbl);
    execute format('drop policy if exists %I on consulting.%I', t.tbl || '_upd',  t.tbl);
    execute format('drop policy if exists %I on consulting.%I', t.tbl || '_del',  t.tbl);

    execute format('create policy %I on consulting.%I for select to authenticated using (%s)',
                   t.tbl || '_read', t.tbl, v_pred);
    execute format('create policy %I on consulting.%I for insert to authenticated with check (%s)',
                   t.tbl || '_ins', t.tbl, v_pred);
    execute format('create policy %I on consulting.%I for update to authenticated using (%s) with check (%s)',
                   t.tbl || '_upd', t.tbl, v_pred, v_pred);
    execute format('create policy %I on consulting.%I for delete to authenticated using (%s)',
                   t.tbl || '_del', t.tbl, v_pred);
    v_count := v_count + 1;
  end loop;

  raise notice 'RLS policies generated for % tables', v_count;
end $$;

-- ============================================================================
-- The audit ledger: read-only to humans, firm-scoped, role-gated.
-- Insert is allowed so ledger_write() works from a caller's transaction; the
-- chain trigger supplies the hashes either way.
-- ============================================================================

create policy audit_ledger_read on consulting.audit_ledger
  for select to authenticated
  using (consulting.in_my_firm(firm_id)
         and consulting.has_firm_role(array['DIRECTOR','PMO_LEAD','FINANCE_CONTROLLER']));

create policy audit_ledger_insert on consulting.audit_ledger
  for insert to authenticated
  with check (consulting.in_my_firm(firm_id));

-- ============================================================================
-- Barrier views — FMEA F-11
--
-- Every aggregate goes through one of these. A view declared `security_barrier`
-- stops the planner pushing a user-supplied predicate inside the view, which is
-- how an attacker turns an aggregate into an oracle ("does this row exist?").
-- The views are NOT security_invoker, so they run with the definer's rights and
-- apply their OWN barrier rather than inheriting the caller's row policies --
-- which is the point: the caller must not see the person-level rows underneath.
-- ============================================================================

-- Role-level supply and demand, with a k-anonymity floor. A cell drawn from
-- fewer than k distinct engagements is suppressed rather than shown, because a
-- single-engagement cell is just that engagement's staffing with a label on it.
create or replace view consulting.v_capacity_role
with (security_barrier = true) as
select
  cs.firm_id,
  cs.role_def_id,
  cs.fiscal_period,
  cs.horizon,
  count(distinct a.project_id)               as engagement_count,
  case when count(distinct a.project_id) >= 3
       then sum(cs.available_hours) end      as available_hours,
  case when count(distinct a.project_id) >= 3
       then sum(cs.committed_hours) end      as committed_hours,
  case when count(distinct a.project_id) >= 3
       then round(sum(cs.committed_hours) / nullif(sum(cs.available_hours),0), 4) end
                                             as utilization_pct,
  count(distinct a.project_id) < 3           as suppressed
from consulting.capacity_snapshot cs
left join consulting.assignment a
       on a.role_def_id = cs.role_def_id
      and a.firm_id = cs.firm_id
where cs.firm_id = consulting.current_firm()
group by cs.firm_id, cs.role_def_id, cs.fiscal_period, cs.horizon;

comment on view consulting.v_capacity_role is
  'Role-level capacity with a k-anonymity floor of 3 engagements. FMEA F-11 '
  'mitigation 2: a cell drawn from one engagement is that engagement''s '
  'staffing with a label on it.';

-- "Committed elsewhere": the clash stays visible and actionable without
-- disclosing its source. A viewer sees that a named person is 140% committed
-- and how much of that they can account for; the remainder is an unattributed
-- block. FMEA F-11 mitigation 4, and what the giant chart's resource lanes
-- render.
create or replace view consulting.v_person_commitment
with (security_barrier = true) as
select
  cs.firm_id,
  cs.user_id,
  cs.fiscal_period,
  cs.available_hours,
  cs.committed_hours                                   as committed_total,
  coalesce(vis.visible_hours, 0)                       as committed_visible,
  cs.committed_hours - coalesce(vis.visible_hours, 0)  as committed_elsewhere,
  round(cs.committed_hours / nullif(cs.available_hours, 0), 4) as utilization_pct
from consulting.capacity_snapshot cs
left join lateral (
  select sum(a.planned_hours) as visible_hours
    from consulting.assignment a
    join consulting.activity   ac on ac.id = a.activity_id
   where a.user_id = cs.user_id
     and consulting.can_see_project(a.project_id)
) vis on true
where cs.firm_id = consulting.current_firm()
  and cs.user_id is not null
  -- Only people the viewer actually works alongside, or anyone if the viewer
  -- holds a firm role. Without this the view would tell everyone in the firm
  -- that any named colleague is over-committed -- far more than the clash
  -- requires, and a staffing signal in its own right.
  and (
    consulting.is_self(cs.user_id)
    or consulting.has_firm_role(array['DIRECTOR','PMO_LEAD','ENGAGEMENT_MANAGER','DELIVERY_LEAD'])
    or exists (
      select 1
        from consulting.engagement_member them
        join consulting.engagement_member me2 on me2.engagement_id = them.engagement_id
        join consulting.app_user u on u.id = me2.user_id
       where them.user_id = cs.user_id
         and u.auth_user_id = auth.uid()
         and consulting.can_see_engagement(them.engagement_id)
    )
  );

comment on view consulting.v_person_commitment is
  'Shows that a person is over-committed, and how much of it the viewer can '
  'account for, WITHOUT naming the other client. The clash stays actionable; '
  'the source stays behind the wall. FMEA F-11 mitigation 4.';

-- Engagement financial roll-up through the barrier. Reads the row policies on
-- evm_snapshot via can_see_project rather than aggregating the base table
-- directly, so a walled engagement contributes nothing at all -- not even to a
-- total that would change when its numbers change.
create or replace view consulting.v_engagement_margin
with (security_barrier = true) as
select
  e.firm_id,
  e.id              as engagement_id,
  e.client_id,
  e.code,
  e.contract_value,
  e.currency,
  s.as_of,
  s.cpi, s.spi_t, s.eac, s.margin_pct, s.margin_erosion_pct,
  s.scope_creep_cost_pct
from consulting.engagement e
join consulting.project p on p.engagement_id = e.id
join lateral (
  select * from consulting.evm_snapshot x
   where x.project_id = p.id order by x.as_of desc limit 1
) s on true
where consulting.can_see_engagement(e.id);

grant select on consulting.v_capacity_role,
               consulting.v_person_commitment,
               consulting.v_engagement_margin
  to authenticated;

-- ============================================================================
-- Meta-guard: a table added later without RLS, or with RLS but no policy, is a
-- hole that no test for a specific table would catch. This function is asserted
-- in proof 40, so adding a table without policies fails the suite.
-- ============================================================================

create or replace function consulting.rls_coverage()
returns table (table_name text, rls_enabled boolean, policy_count bigint)
language sql stable
as $$
  select c.relname::text,
         c.relrowsecurity,
         (select count(*) from pg_policy p where p.polrelid = c.oid)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'consulting'
     and c.relkind = 'r'
   order by c.relname;
$$;

comment on function consulting.rls_coverage() is
  'Every consulting table with its RLS flag and policy count. Asserted in '
  'supabase/tests/40: a new table with no policy fails the suite.';
