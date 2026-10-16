-- ============================================================================
-- 0011 — consulting.seed_firm_defaults(firm_id)
--
-- Provisions a new firm's governance defaults: roles, the five phases, the four
-- gates and their criteria, the formula registry entries those criteria resolve,
-- a default scoring model, a calendar, a deployment checklist template and the
-- ten agent definitions.
--
-- Written as a FUNCTION, not as INSERT statements in a migration, for two
-- reasons: every new firm needs these (so it is production code, not demo
-- data), and the test suite can call it against a throwaway firm.
--
-- Everything it writes is DATA. Changing intake_score_floor, margin_floor or
-- uat_pass_floor is an UPDATE to a formula_version's input_bindings, approved
-- through formula_change_request. No deployment, no code change. That is what
-- "do not hardwire any metrics" means operationally.
-- ============================================================================

-- Creates a formula with v1 ACTIVE and a FIRM-scope binding, and returns the
-- formula id. Bypasses the no-self-approval constraint only for seeding, where
-- there is no human author yet -- real changes go through
-- formula_change_request (see guard below).
create or replace function consulting.seed_formula(
  p_firm_id uuid,
  p_code    text,
  p_name    text,
  p_domain  text,
  p_unit    text,
  p_src     text,
  p_ast     jsonb,
  p_params  jsonb default '{}'::jsonb
) returns uuid
language plpgsql
as $$
declare v_f uuid; v_v uuid;
begin
  insert into consulting.formula (firm_id, code, name, domain, unit, description)
  values (p_firm_id, p_code, p_name, p_domain, p_unit, p_src)
  on conflict (firm_id, code) do update set name = excluded.name
  returning id into v_f;

  -- provenance = SEEDED, with no approver and no author. These are shipped
  -- defaults, not decisions anyone here has made; consulting.formula_staleness
  -- reports them until a human replaces them through formula_change_request.
  insert into consulting.formula_version
    (firm_id, formula_id, version, expression_ast, expression_src, input_bindings,
     state, provenance, content_hash, notes)
  values
    (p_firm_id, v_f, 1, p_ast, p_src, p_params, 'ACTIVE', 'SEEDED',
     sha256((p_src || p_params::text)::bytea), 'shipped default, never reviewed by this firm')
  on conflict (formula_id, version) do nothing
  returning id into v_v;

  if v_v is null then
    select id into v_v from consulting.formula_version
     where formula_id = v_f and version = 1;
  end if;

  insert into consulting.formula_binding
    (firm_id, formula_id, formula_version_id, scope_kind, effective_from)
  values (p_firm_id, v_f, v_v, 'FIRM', now())
  on conflict do nothing;

  return v_f;
end $$;

create or replace function consulting.seed_firm_defaults(p_firm_id uuid)
returns void
language plpgsql
as $$
declare
  r         record;
  v_phase   jsonb := '{}'::jsonb;   -- code -> id
  v_role    jsonb := '{}'::jsonb;
  v_formula jsonb := '{}'::jsonb;
  v_gate    uuid;
  v_model   uuid;
  v_tmpl    uuid;
  v_id      uuid;
begin
  -- ------------------------------------------------------------------ roles
  for r in
    select * from (values
      ('DIRECTOR',            'Director',             100, false, true,  true,  true ),
      ('PMO_LEAD',            'PMO Lead',              90, false, true,  true,  true ),
      ('FINANCE_CONTROLLER',  'Finance Controller',    85, false, true,  false, true ),
      ('CLIENT_SPONSOR',      'Client Sponsor',        80, true,  false, false, true ),
      ('ENGAGEMENT_MANAGER',  'Engagement Manager',    70, false, false, true,  true ),
      ('DELIVERY_LEAD',       'Delivery Lead',         60, false, false, false, true ),
      ('SOLUTION_ARCHITECT',  'Solution Architect',    55, false, false, false, false),
      ('QA_LEAD',             'QA Lead',               55, false, false, false, true ),
      ('CLIENT_UAT_APPROVER', 'Client UAT Approver',   50, true,  false, false, true ),
      ('CONSULTANT',          'Consultant',            30, false, false, false, false),
      ('ANALYST',             'Analyst',               20, false, false, false, false),
      ('CLIENT_OBSERVER',     'Client Observer',       10, true,  false, false, false)
    ) as t(code, name, rank, client_side, can_waive, can_delegate, can_sign)
  loop
    insert into consulting.role_def
      (firm_id, code, name, authority_rank, is_client_side, can_waive, can_delegate, can_sign)
    values (p_firm_id, r.code, r.name, r.rank, r.client_side, r.can_waive, r.can_delegate, r.can_sign)
    on conflict (firm_id, code) do update set name = excluded.name
    returning id into v_id;
    v_role := v_role || jsonb_build_object(r.code, v_id);
  end loop;

  -- Domain-scoped waiver authority. A Finance Controller may waive financial
  -- criteria and nothing else; only DIRECTOR and PMO_LEAD get 'ANY'.
  for r in
    select * from (values
      ('DIRECTOR','ANY'), ('PMO_LEAD','ANY'),
      ('FINANCE_CONTROLLER','EVM'), ('FINANCE_CONTROLLER','REVENUE')
    ) as t(role_code, dom)
  loop
    insert into consulting.role_waiver_domain (firm_id, role_def_id, domain)
    values (p_firm_id, (v_role->>r.role_code)::uuid, r.dom)
    on conflict (role_def_id, domain) do nothing;
  end loop;

  -- ------------------------------------------------------------------ phases
  for r in
    select * from (values
      ('INTAKE',     1, 'Ideation & Intake',     false),
      ('SCOPING',    2, 'Scoping & Planning',    false),
      ('EXECUTION',  3, 'Execution & Tracking',  false),
      ('QA',         4, 'Testing & QA',          false),
      ('DEPLOYMENT', 5, 'Deployment & Handover', false),
      ('CLOSED',     6, 'Closed',                true )
    ) as t(code, seq, name, terminal)
  loop
    insert into consulting.phase_def (firm_id, code, seq, name, is_terminal)
    values (p_firm_id, r.code, r.seq, r.name, r.terminal)
    on conflict (firm_id, code) do update set name = excluded.name
    returning id into v_id;
    v_phase := v_phase || jsonb_build_object(r.code, v_id);
  end loop;

  -- ------------------------------------------------------------------ formulae
  -- Each is the METRIC. The gate criterion supplies the comparator and the
  -- threshold, so the same metric can gate differently per engagement.
  for r in
    select * from (values
      ('OPP_SCORE_TOTAL','Composite opportunity score','SCORING','ratio',
       'sum(w_i * n_i) / sum(w_i)',
       '{"op":"div","args":[{"agg":"sum","of":"weighted_value"},{"agg":"sum","of":"weight"}]}',
       '{"intake_score_floor":0.60}'),
      ('OPP_BLOCKING_FAILS','Count of failed blocking criteria','SCORING','count',
       'count(i : is_blocking and n_i < block_threshold_i)',
       '{"op":"count","where":{"and":["is_blocking",{"op":"lt","args":[{"var":"normalized_value"},{"var":"block_threshold"}]}]}}','{}'),
      ('OPP_ALIGNMENT','Strategic alignment from the objective tree','SCORING','ratio',
       'sum(c_j * prod(normalised ancestor weights))',
       '{"op":"treeRollup","tree":"objective","contribution":"contribution_pct","weight":"weight"}','{}'),
      ('CAPACITY_FEASIBLE','Intake capacity feasibility','CAPACITY','boolean',
       'min slack over (role, period) >= slack_floor',
       '{"op":"gte","args":[{"agg":"min","of":"slack_hours"},{"param":"slack_floor"}]}',
       '{"slack_floor":0,"util_ceiling":1.0,"util_warn":0.85,"min_prof":3}'),
      ('CONFLICT_CLEAR','Conflict-of-interest check is clear','GOVERNANCE','boolean',
       'conflict_check.result = CLEAR',
       '{"op":"eq","args":[{"var":"conflict_result"},{"lit":"CLEAR"}]}','{}'),
      ('ESTIMATE_COVERAGE','Roles with a three-point estimate','CAPACITY','count',
       'count(distinct role_def_id in resource_estimate)',
       '{"op":"countDistinct","of":"role_def_id"}','{"pert_weights":[1,4,1]}'),
      ('OBJECTIVE_LINKAGE','Total objective contribution','SCORING','ratio',
       'sum(contribution_pct)',
       '{"op":"sum","of":"contribution_pct"}','{}'),

      ('WBS_UNDECOMPOSED','Summary nodes with no children','SCHEDULE','count',
       'count(node_type=SUMMARY and not exists child)',
       '{"op":"count","where":{"and":[{"op":"eq","args":[{"var":"node_type"},{"lit":"SUMMARY"}]},{"var":"is_leaf"}]}}','{}'),
      ('SCHED_CYCLES','Dependency cycles','SCHEDULE','count','count(SCC with |SCC|>1)',
       '{"op":"tarjanSccCount"}','{}'),
      ('SCHED_DANGLING','Dangling activities','SCHEDULE','count',
       'no-predecessor + no-successor, excluding start/end milestones',
       '{"op":"danglingCount"}','{}'),
      ('SCHED_NEG_FLOAT','Activities with negative total float','SCHEDULE','count',
       'count(total_float < 0)',
       '{"op":"count","where":{"op":"lt","args":[{"var":"total_float"},{"lit":0}]}}',
       '{"critical_float_threshold":0}'),
      ('SCHED_HARD_CONSTRAINTS','Hard date constraints','SCHEDULE','count',
       'count(constraint_type in MSO,MFO,SNLT,FNET)',
       '{"op":"count","where":{"op":"in","args":[{"var":"constraint_type"},{"lit":["MSO","MFO","SNLT","FNET"]}]}}',
       '{"hard_constraint_max":3}'),
      ('SCHED_LOGIC_DENSITY','Dependencies per activity','SCHEDULE','ratio',
       '|dependencies| / |activities|',
       '{"op":"div","args":[{"count":"dependency"},{"count":"activity"}]}',
       '{"logic_density_min":1.2,"logic_density_max":3.0}'),
      ('LEAF_UNRESOURCED','Leaf activities with no assignment','CAPACITY','count',
       'count(leaf activity with no assignment)',
       '{"op":"count","where":{"op":"not","args":[{"exists":"assignment"}]}}','{}'),
      ('PLAN_FINISH_SLACK','Days from plan finish to contract date','SCHEDULE','days',
       'contract_milestone_date - planned_finish',
       '{"op":"dateDiff","args":[{"var":"contract_milestone_date"},{"var":"planned_finish"}]}','{}'),
      ('PLANNED_MARGIN','Planned margin at baseline','EVM','ratio',
       '(contract_value - BAC) / contract_value',
       '{"op":"div","args":[{"op":"sub","args":[{"var":"contract_value"},{"var":"bac"}]},{"var":"contract_value"}]}',
       '{"margin_floor":0.18,"margin_warn":0.12,"margin_critical":0.05}'),

      ('BUILD_COMPLETE','Incomplete BUILD work packages','EVM','count',
       'count(scope_class=BUILD and pct_complete < 1)',
       '{"op":"count","where":{"and":[{"op":"eq","args":[{"var":"scope_class"},{"lit":"BUILD"}]},{"op":"lt","args":[{"var":"pct_complete"},{"lit":1}]}]}}','{}'),
      ('COVERAGE_GAPS','Baselined deliverables with no test case','QUALITY','count',
       'count(baseline_scope node with zero test_case)',
       '{"op":"count","where":{"op":"not","args":[{"exists":"test_case"}]}}','{}'),
      ('EVM_CPI','Cost Performance Index','EVM','index','EV / AC',
       '{"op":"div","args":[{"var":"ev"},{"var":"ac"}]}',
       '{"cpi_floor":0.90,"force_bottom_up_cpi":0.85,"tcpi_credibility":1.10,"eac_method":"COMPOSITE"}'),
      ('EVM_SPI_T','Earned-Schedule Performance Index','EVM','index','ES / AT',
       '{"op":"div","args":[{"var":"es_days"},{"var":"at_days"}]}',
       '{"spi_t_floor":0.90,"spi_degeneracy_point":0.90}'),
      ('EVM_MARGIN','Current margin at EAC','EVM','ratio',
       '(contract_value - EAC) / contract_value',
       '{"op":"div","args":[{"op":"sub","args":[{"var":"contract_value"},{"var":"eac"}]},{"var":"contract_value"}]}',
       '{"margin_warn":0.12,"margin_critical":0.05}'),
      ('REV_ONEROUS','Onerous contract flag','REVENUE','boolean','EAC > contract_value',
       '{"op":"gt","args":[{"var":"eac"},{"var":"contract_value"}]}','{}'),

      ('UAT_PASS_RATE','UAT pass rate','QUALITY','ratio','PASS / (PASS + FAIL)',
       '{"op":"div","args":[{"count":"PASS"},{"op":"add","args":[{"count":"PASS"},{"count":"FAIL"}]}]}',
       '{"uat_pass_floor":0.95,"blocked_rate_max":0.05}'),
      ('UAT_BLOCKED_RATE','UAT blocked rate','QUALITY','ratio','BLOCKED / total',
       '{"op":"div","args":[{"count":"BLOCKED"},{"count":"total"}]}','{"blocked_rate_max":0.05}'),
      ('DEFECT_OPEN_S1','Open S1 defects','QUALITY','count','count(severity=S1 and open)',
       '{"op":"count","where":{"op":"eq","args":[{"var":"severity"},{"lit":"S1"}]}}','{}'),
      ('DEFECT_OPEN_S2','Open S2 defects','QUALITY','count','count(severity=S2 and open)',
       '{"op":"count","where":{"op":"eq","args":[{"var":"severity"},{"lit":"S2"}]}}','{"open_s2_max":0}'),
      ('DEFECT_DENSITY','Severity-weighted defect density','QUALITY','ratio',
       'sum(count_s * sev_weight_s) / size_measure',
       '{"op":"div","args":[{"op":"weightedSum","of":"severity","weights":{"param":"sev_weight"}},{"var":"size_measure"}]}',
       '{"size_basis":"WORK_PACKAGES","sev_weight":{"S1":10,"S2":5,"S3":2,"S4":1},"density_ceiling":0.35}'),
      ('DEFECT_RESIDUAL','Predicted remaining defects','QUALITY','count',
       'N_inf - N(t), Goel-Okumoto fit',
       '{"op":"arrivalFit","model":{"param":"arrival_model"},"minPoints":{"param":"min_fit_points"}}',
       '{"arrival_model":"GOEL_OKUMOTO","min_fit_points":5,"residual_max":4}'),
      ('TRACEABILITY','Baselined deliverables with an executed UAT case','QUALITY','ratio',
       'covered / total, against baseline_scope',
       '{"op":"div","args":[{"count":"covered"},{"count":"baselined"}]}','{}'),
      ('DEFECT_REOPEN_RATE','Defect reopen rate','QUALITY','ratio',
       'reopened / closed',
       '{"op":"div","args":[{"count":"reopened"},{"count":"closed"}]}','{"reopen_rate_max":0.10}'),

      ('CHECKLIST_UNVERIFIED','Unverified blocking checklist items','GOVERNANCE','count',
       'count(is_blocking and state <> VERIFIED)',
       '{"op":"count","where":{"and":["is_blocking",{"op":"neq","args":[{"var":"state"},{"lit":"VERIFIED"}]}]}}','{}'),
      ('REVENUE_RECONCILED','Contract value less recognised revenue','REVENUE','currency',
       'contract_value - revenue_cum',
       '{"op":"sub","args":[{"var":"contract_value"},{"var":"revenue_cum"}]}',
       '{"reconcile_tolerance":1.00}'),
      ('MILESTONES_UNGATED','Released milestones with no passed gate','REVENUE','count',
       'count(milestone released without a passed gate_instance)',
       '{"op":"count","where":{"op":"not","args":[{"var":"gate_passed"}]}}','{}'),

      ('RISK_P_BREACH','Probability of gate-date breach','RISK','probability',
       'count(forecast > required) / N',
       '{"op":"monteCarlo","metric":"p_breach"}',
       '{"iterations":10000,"rho_default":0.30,"foresight_days":180,"min_duration":0.5}'),
      ('GOV_SIGNOFF_LATENCY','Signoff latency','GOVERNANCE','seconds',
       'signed_at - gate_opened_at',
       '{"op":"sub","args":[{"var":"signed_at"},{"var":"opened_at"}]}',
       '{"min_review_seconds":60,"max_approvals_per_day":10}'),
      ('SCOPE_CREEP','Scope creep against the ORIGINAL baseline','EVM','ratio',
       '(BAC_current - BAC_original) / BAC_original',
       '{"op":"div","args":[{"op":"sub","args":[{"var":"bac_current"},{"var":"bac_original"}]},{"var":"bac_original"}]}','{}'),
      ('CLASH_PRIORITY','Clash priority score','RISK','score',
       '(w_sev*sev + w_mag*mag + w_prob*p) / (1 + w_lead*lead)',
       '{"op":"clashPriority"}',
       '{"w_sev":0.4,"w_mag":0.3,"w_prob":0.3,"w_lead":0.02,"demote_floor":0.30,"proposal_ttl_hours":72}')
    ) as t(code, name, dom, unit, src, ast, params)
  loop
    v_id := consulting.seed_formula(p_firm_id, r.code, r.name, r.dom, r.unit,
                                    r.src, r.ast::jsonb, r.params::jsonb);
    v_formula := v_formula || jsonb_build_object(r.code, v_id);
  end loop;

  -- ------------------------------------------------------------------ gates
  for r in
    select * from (values
      ('G0','Intake Gate',                 'INTAKE',    'SCOPING',    48),
      ('G1','Scope Baseline Gate',         'SCOPING',   'EXECUTION',  72),
      ('G2','Test-Readiness Gate',         'EXECUTION', 'QA',         48),
      ('G3','UAT Sign-off Gate',           'QA',        'DEPLOYMENT', 72),
      ('G4','Deployment & Handover Gate',  'DEPLOYMENT','CLOSED',     72)
    ) as t(code, name, pfrom, pto, sla)
  loop
    insert into consulting.gate_def
      (firm_id, code, name, phase_from_id, phase_to_id, four_eyes, sla_hours)
    values (p_firm_id, r.code, r.name,
            (v_phase->>r.pfrom)::uuid, (v_phase->>r.pto)::uuid, true, r.sla)
    on conflict (firm_id, code) do update set name = excluded.name;
  end loop;

  -- REWORK edges: backwards transitions with a named authorising role instead
  -- of the full criterion set.
  insert into consulting.gate_def
    (firm_id, code, name, phase_from_id, phase_to_id, four_eyes, is_rework, rework_role_id)
  values
    (p_firm_id, 'R_QA_EXEC', 'Rework: QA to Execution',
     (v_phase->>'QA')::uuid, (v_phase->>'EXECUTION')::uuid, false, true,
     (v_role->>'DELIVERY_LEAD')::uuid),
    (p_firm_id, 'R_EXEC_SCOPE', 'Rework: Execution to Scoping',
     (v_phase->>'EXECUTION')::uuid, (v_phase->>'SCOPING')::uuid, false, true,
     (v_role->>'ENGAGEMENT_MANAGER')::uuid)
  on conflict (firm_id, code) do nothing;

  -- ------------------------------------------------------------------ criteria
  for r in
    select * from (values
      -- gate, code, label, type, domain, formula, cmp, threshold, role, blocking, waivable, evidence
      ('G0','SCORE_FLOOR','Composite score meets the intake floor','FORMULA','SCORING','OPP_SCORE_TOTAL','GTE','intake_score_floor',null,true,false,false),
      ('G0','NO_BLOCKING_FAIL','No blocking scoring criterion failed','FORMULA','SCORING','OPP_BLOCKING_FAILS','EQ','0',null,true,false,false),
      ('G0','CAPACITY_FEASIBLE','Capacity is feasible in the proposed window','FORMULA','CAPACITY','CAPACITY_FEASIBLE','IS_TRUE',null,null,true,true,false),
      ('G0','CONFLICT_CLEAR','Conflict-of-interest check is clear','EXTERNAL_CHECK','GOVERNANCE','CONFLICT_CLEAR','IS_TRUE',null,null,true,false,true),
      ('G0','ESTIMATE_PRESENT','A three-point estimate exists for each required role','FORMULA','CAPACITY','ESTIMATE_COVERAGE','GT','0',null,true,false,false),
      ('G0','OBJECTIVE_LINKED','Linked to at least one objective','FORMULA','SCORING','OBJECTIVE_LINKAGE','GT','0',null,true,false,false),
      ('G0','SIGN_PMO','PMO Lead approval','SIGNOFF','GOVERNANCE',null,null,null,'PMO_LEAD',true,false,false),
      ('G0','SIGN_DIRECTOR','Director approval above the value threshold','SIGNOFF','GOVERNANCE',null,null,null,'DIRECTOR',true,false,false),

      ('G1','WBS_DECOMPOSED','Every summary node has children','FORMULA','SCHEDULE','WBS_UNDECOMPOSED','EQ','0',null,true,false,false),
      ('G1','NO_CYCLES','No dependency cycles','FORMULA','SCHEDULE','SCHED_CYCLES','EQ','0',null,true,false,false),
      ('G1','NO_DANGLING','No dangling activities','FORMULA','SCHEDULE','SCHED_DANGLING','EQ','0',null,true,false,false),
      ('G1','NO_NEG_FLOAT','No negative total float','FORMULA','SCHEDULE','SCHED_NEG_FLOAT','EQ','0',null,true,false,false),
      ('G1','CONSTRAINTS_BOUNDED','Hard constraints within limit','FORMULA','SCHEDULE','SCHED_HARD_CONSTRAINTS','LTE','hard_constraint_max',null,true,true,false),
      ('G1','LOGIC_DENSITY','Network logic density within band','FORMULA','SCHEDULE','SCHED_LOGIC_DENSITY','GTE','logic_density_min',null,true,true,false),
      ('G1','ALL_RESOURCED','Every leaf activity is resourced','FORMULA','CAPACITY','LEAF_UNRESOURCED','EQ','0',null,true,false,false),
      ('G1','PLAN_FITS_CONTRACT','Plan finish is on or before the contract date','FORMULA','SCHEDULE','PLAN_FINISH_SLACK','GTE','0',null,true,true,false),
      ('G1','MARGIN_FLOOR','Planned margin meets the floor','FORMULA','EVM','PLANNED_MARGIN','GTE','margin_floor',null,true,true,false),
      ('G1','BASELINE_TAKEN','The original baseline has been taken','DELIVERABLE','GOVERNANCE',null,null,null,null,true,false,false),
      ('G1','CONTRACT_SIGNED','The engagement contract is signed','EXTERNAL_CHECK','GOVERNANCE',null,null,null,null,true,false,true),
      ('G1','SIGN_FINANCE','Finance Controller budget approval','SIGNOFF','EVM',null,null,null,'FINANCE_CONTROLLER',true,false,false),
      ('G1','SIGN_ENGMGR','Engagement Manager delivery approval','SIGNOFF','GOVERNANCE',null,null,null,'ENGAGEMENT_MANAGER',true,false,false),
      ('G1','SIGN_CLIENT','Client Sponsor scope acceptance','SIGNOFF','GOVERNANCE',null,null,null,'CLIENT_SPONSOR',true,false,false),

      ('G2','BUILD_DONE','All BUILD work packages complete','FORMULA','EVM','BUILD_COMPLETE','EQ','0',null,true,false,false),
      ('G2','COVERAGE','Every baselined deliverable has a test case','FORMULA','QUALITY','COVERAGE_GAPS','EQ','0',null,true,false,false),
      ('G2','TEST_PLAN_APPROVED','The test plan is approved','DELIVERABLE','QUALITY',null,null,null,null,true,false,false),
      ('G2','SPI_T_FLOOR','Earned-schedule performance meets the floor','FORMULA','EVM','EVM_SPI_T','GTE','spi_t_floor',null,true,true,true),
      ('G2','CPI_FLOOR','Cost performance meets the floor','FORMULA','EVM','EVM_CPI','GTE','cpi_floor',null,true,true,true),
      ('G2','MARGIN_WARN','Margin above the warning level','FORMULA','EVM','EVM_MARGIN','GTE','margin_warn',null,true,true,false),
      ('G2','NOT_ONEROUS','Contract is not onerous, or a provision is booked','FORMULA','REVENUE','REV_ONEROUS','IS_FALSE',null,null,true,true,true),
      ('G2','ENV_READY','Test environment checklist complete','CHECKLIST','GOVERNANCE',null,null,null,null,true,false,false),
      ('G2','SIGN_QA','QA Lead readiness','SIGNOFF','QUALITY',null,null,null,'QA_LEAD',true,false,false),
      ('G2','SIGN_DELIVERY','Delivery Lead readiness','SIGNOFF','GOVERNANCE',null,null,null,'DELIVERY_LEAD',true,false,false),

      ('G3','PASS_RATE','UAT pass rate meets the floor','FORMULA','QUALITY','UAT_PASS_RATE','GTE','uat_pass_floor',null,true,false,false),
      ('G3','BLOCKED_RATE','Blocked rate within limit','FORMULA','QUALITY','UAT_BLOCKED_RATE','LTE','blocked_rate_max',null,true,true,false),
      ('G3','NO_OPEN_S1','No open S1 defects','FORMULA','QUALITY','DEFECT_OPEN_S1','EQ','0',null,true,false,false),
      ('G3','OPEN_S2_LIMIT','Open S2 defects within limit','FORMULA','QUALITY','DEFECT_OPEN_S2','LTE','open_s2_max',null,true,true,false),
      ('G3','DENSITY_CEILING','Weighted defect density within ceiling','FORMULA','QUALITY','DEFECT_DENSITY','LTE','density_ceiling',null,true,true,false),
      ('G3','RESIDUAL_LIMIT','Predicted residual defects within limit','FORMULA','QUALITY','DEFECT_RESIDUAL','LTE','residual_max',null,true,true,false),
      ('G3','REOPEN_RATE','Defect reopen rate within limit','FORMULA','QUALITY','DEFECT_REOPEN_RATE','LTE','reopen_rate_max',null,true,true,false),
      ('G3','TRACEABILITY','Full requirement-to-test traceability','FORMULA','QUALITY','TRACEABILITY','GTE','1',null,true,false,false),
      ('G3','SIGN_CLIENT_UAT','Client UAT approver sign-off','SIGNOFF','QUALITY',null,null,null,'CLIENT_UAT_APPROVER',true,false,true),
      ('G3','SIGN_QA_FINAL','QA Lead sign-off','SIGNOFF','QUALITY',null,null,null,'QA_LEAD',true,false,false),

      ('G4','CHECKLIST_DONE','All blocking checklist items verified','FORMULA','GOVERNANCE','CHECKLIST_UNVERIFIED','EQ','0',null,true,true,false),
      ('G4','HANDOVER_PACK','Handover package generated and hashed','DELIVERABLE','GOVERNANCE',null,null,null,null,true,false,true),
      ('G4','REVENUE_RECONCILED','Recognised revenue reconciles to contract value','FORMULA','REVENUE','REVENUE_RECONCILED','LTE','reconcile_tolerance',null,true,true,false),
      ('G4','MILESTONES_GATED','Every released milestone has a passed gate','FORMULA','REVENUE','MILESTONES_UNGATED','EQ','0',null,true,false,false),
      ('G4','POSTMORTEM_SET','Post-mortem scheduled','DELIVERABLE','GOVERNANCE',null,null,null,null,true,true,false),
      ('G4','SIGN_CLIENT_FINAL','Client Sponsor final acceptance','SIGNOFF','GOVERNANCE',null,null,null,'CLIENT_SPONSOR',true,false,true),
      ('G4','SIGN_DIRECTOR_CLOSE','Director closeout','SIGNOFF','GOVERNANCE',null,null,null,'DIRECTOR',true,false,false)
    ) as t(gate, code, label, ctype, dom, fcode, cmp, thresh, role_code, blocking, waivable, evidence)
  loop
    select id into v_gate from consulting.gate_def
     where firm_id = p_firm_id and code = r.gate;

    insert into consulting.gate_criterion
      (firm_id, gate_def_id, code, label, criterion_type, domain, formula_id,
       comparator, threshold_expr, required_role_id, is_blocking, waiver_allowed,
       evidence_required, condition_expr)
    values
      (p_firm_id, v_gate, r.code, r.label, r.ctype, r.dom,
       case when r.fcode is null then null else (v_formula->>r.fcode)::uuid end,
       r.cmp, r.thresh,
       case when r.role_code is null then null else (v_role->>r.role_code)::uuid end,
       r.blocking, r.waivable, r.evidence,
       -- the only value-gated signoff in the default set
       case when r.code = 'SIGN_DIRECTOR' then 'estimated_value > director_threshold' end)
    on conflict (gate_def_id, code) do nothing;
  end loop;

  -- ------------------------------------------------------------------ scoring model
  insert into consulting.scoring_model (firm_id, code, version, name, state, approved_at)
  values (p_firm_id, 'DEFAULT_INTAKE', 1, 'Default intake scoring model', 'ACTIVE', now())
  on conflict (firm_id, code, version) do nothing
  returning id into v_model;
  if v_model is null then
    select id into v_model from consulting.scoring_model
     where firm_id = p_firm_id and code = 'DEFAULT_INTAKE' and version = 1;
  end if;

  for r in
    select * from (values
      ('ROI','Return on investment',           2.0,'HIGHER_BETTER','DERIVED','OPP_SCORE_TOTAL',false,null),
      ('ALIGNMENT','Strategic alignment',      2.0,'HIGHER_BETTER','DERIVED','OPP_ALIGNMENT',  false,null),
      ('COMPLEXITY','Delivery complexity',     1.0,'LOWER_BETTER', 'MANUAL', null,             false,null),
      ('RISK','Delivery risk',                 1.5,'LOWER_BETTER', 'MANUAL', null,             true, 0.25),
      ('CLIENT_FIT','Client relationship fit', 1.0,'HIGHER_BETTER','MANUAL', null,             false,null),
      ('CAPABILITY','Capability match',        1.5,'HIGHER_BETTER','MANUAL', null,             true, 0.20)
    ) as t(code, label, weight, dir, src, fcode, blocking, thresh)
  loop
    insert into consulting.scoring_criterion
      (firm_id, scoring_model_id, code, label, weight, direction, source,
       formula_id, is_blocking, block_threshold)
    values (p_firm_id, v_model, r.code, r.label, r.weight, r.dir, r.src,
            case when r.fcode is null then null else (v_formula->>r.fcode)::uuid end,
            r.blocking, r.thresh)
    on conflict (scoring_model_id, code) do nothing;
  end loop;

  -- ------------------------------------------------------------------ calendar
  insert into consulting.calendar (firm_id, code, name, timezone, hours_per_day, work_days)
  values (p_firm_id, 'STD', 'Standard working week', 'UTC', 8.0, '{1,2,3,4,5}')
  on conflict (firm_id, code) do nothing;

  -- ------------------------------------------------------------------ checklist
  insert into consulting.checklist_template (firm_id, code, version, name, applies_to)
  values (p_firm_id, 'DEPLOY_STD', 1, 'Standard deployment checklist', 'DEPLOYMENT')
  on conflict (firm_id, code, version) do nothing
  returning id into v_tmpl;
  if v_tmpl is null then
    select id into v_tmpl from consulting.checklist_template
     where firm_id = p_firm_id and code = 'DEPLOY_STD' and version = 1;
  end if;

  for r in
    select * from (values
      (10,'Production environment provisioned and reachable','AUTOMATED_CHECK','env.reachable',true),
      (20,'Database migrations applied and verified','AUTOMATED_CHECK','db.migrations',true),
      (30,'Rollback plan documented and rehearsed','EVIDENCE_UPLOAD',null,true),
      (40,'Monitoring and alerting configured','AUTOMATED_CHECK','observability.ready',true),
      (50,'Access handed over to client operations','EVIDENCE_UPLOAD',null,true),
      (60,'Runbook and support model delivered','EVIDENCE_UPLOAD',null,true),
      (70,'Open defects communicated and accepted','MANUAL',null,true),
      (80,'Knowledge-transfer sessions completed','MANUAL',null,false),
      (90,'Documentation published to the client wiki','MANUAL',null,false)
    ) as t(seq, txt, vtype, chk, blocking)
  loop
    insert into consulting.checklist_template_item
      (firm_id, template_id, seq, text, verification_type, check_code, is_blocking)
    values (p_firm_id, v_tmpl, r.seq, r.txt, r.vtype, r.chk, r.blocking)
    on conflict (template_id, seq) do nothing;
  end loop;

  -- ------------------------------------------------------------------ agents
  -- GateKeeper and AuditSentinel are L1 by design, not by oversight: the one
  -- place agent influence is held furthest from the decision is the gate.
  for r in
    select * from (values
      ('INTAKE_TRIAGE',   'IntakeTriageAgent',   'SCORING',   'L2','PMO_LEAD',           8),
      ('ESTIMATION',      'EstimationAgent',     'CAPACITY',  'L2','DELIVERY_LEAD',      8),
      ('SCHEDULE',        'ScheduleAgent',       'SCHEDULE',  'L2','DELIVERY_LEAD',     12),
      ('RESOURCE_CLASH',  'ResourceClashAgent',  'CAPACITY',  'L2','DELIVERY_LEAD',     12),
      ('FINANCIAL_GUARD', 'FinancialGuardAgent', 'EVM',       'L2','FINANCE_CONTROLLER',10),
      ('QA',              'QAAgent',             'QUALITY',   'L2','QA_LEAD',           10),
      ('GATEKEEPER',      'GateKeeperAgent',     'GOVERNANCE','L1','PMO_LEAD',           0),
      ('AUDIT_SENTINEL',  'AuditSentinelAgent',  'AUDIT',     'L1','PMO_LEAD',           0),
      ('FORESIGHT',       'ForesightAgent',      'RISK',      'L2','ENGAGEMENT_MANAGER', 6),
      ('POST_MORTEM',     'PostMortemAgent',     'GOVERNANCE','L2','PMO_LEAD',           4)
    ) as t(code, name, dom, level, role_code, budget)
  loop
    insert into consulting.agent_def
      (firm_id, code, name, domain, authority_level, daily_proposal_budget)
    values (p_firm_id, r.code, r.name, r.dom, r.level, r.budget)
    on conflict (firm_id, code) do nothing;
  end loop;
end $$;

comment on function consulting.seed_firm_defaults(uuid) is
  'Provisions a firm''s governance defaults: 12 roles, 5 phases + CLOSED, '
  '5 gates + 2 rework edges, 48 gate criteria, 37 registry formulae, a scoring '
  'model, a calendar, a deployment checklist and 10 agent definitions. '
  'Every threshold is a formula_version input_binding, not a constant in code.';
