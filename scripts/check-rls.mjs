/**
 * Proves the lot/certificate access rules behave as designed, rather than
 * trusting that the policy reads correctly.
 *
 * The claim under test is the one the storefront's credibility rests on: a
 * certificate is exactly as public as the lot it belongs to, and unpublishing
 * revokes it in the same action. That is expressed as a storage policy joining
 * back to `lots.published`, which is easy to write and easy to get subtly
 * wrong.
 *
 * SAFETY: this writes a fixture row, so it refuses to run against anything but
 * a local database unless --force is passed. Never point it at production.
 *
 *   node scripts/check-rls.mjs [postgres://…]
 */
import pg from 'pg';

const url = process.argv.find((a) => a.startsWith('postgres')) ?? process.env.SUPABASE_DB_URL;
const force = process.argv.includes('--force');

if (!url) {
  console.log('check-rls: no database URL. Skipping.');
  process.exit(0);
}
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
if (!isLocal && !force) {
  console.error('check-rls: refusing to write fixtures to a non-local database. Pass --force if you are certain.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
let fails = 0;
const check = (c, m) => { console.log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) fails++; };

const LOT = '__rls_probe__';
const OBJ = '__rls_probe__.pdf';

async function visibleAsAnon() {
  await client.query('set local role anon');
  const lots = await client.query('select count(*)::int n from public.lots where lot_code = $1', [LOT]);
  const objs = await client.query(
    "select count(*)::int n from storage.objects where bucket_id='certificates' and name=$1", [OBJ]
  );
  await client.query('reset role');
  return { lots: lots.rows[0].n, certs: objs.rows[0].n };
}

try {
  await client.connect();
  await client.query('begin');

  await client.query('grant usage on schema public, storage to anon');
  await client.query('grant select on public.lots, storage.objects to anon');

  await client.query(
    `insert into public.lots (lot_code, product_slug, status, published, coa_path)
     values ($1, 'bpc-157', 'released', false, $2)`, [LOT, OBJ]
  );
  await client.query(
    "insert into storage.objects (bucket_id, name) values ('certificates', $1)", [OBJ]
  );

  let v = await visibleAsAnon();
  check(v.lots === 0, 'unpublished lot is invisible to anon');
  check(v.certs === 0, 'its certificate is invisible to anon');

  await client.query('update public.lots set published = true where lot_code = $1', [LOT]);
  v = await visibleAsAnon();
  check(v.lots === 1, 'publishing makes the lot visible');
  check(v.certs === 1, 'publishing makes its certificate visible in the same action');

  await client.query('update public.lots set published = false where lot_code = $1', [LOT]);
  v = await visibleAsAnon();
  check(v.lots === 0, 'unpublishing hides the lot again');
  check(v.certs === 0, 'unpublishing revokes the certificate immediately');

  // anon must never write. The failure is expected, and in Postgres a failed
  // statement poisons the whole transaction — so it runs inside a savepoint
  // that can be rolled back without losing everything above.
  await client.query('savepoint probe_write');
  await client.query('set local role anon');
  let refused = false;
  try {
    await client.query(
      "insert into public.lots (lot_code, product_slug, status) values ('__rls_hack__','bpc-157','released')"
    );
  } catch {
    refused = true;
  }
  await client.query('rollback to savepoint probe_write');
  await client.query('reset role');
  check(refused, 'anon cannot insert a lot');

  // Everything above ran inside a transaction we now discard, so no fixture
  // survives this script even if it fails.
  await client.query('rollback');
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error(`check-rls: ${err.message}`);
  fails++;
} finally {
  await client.end().catch(() => {});
}

console.log(fails === 0 ? '\nALL RLS CHECKS PASSED' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
