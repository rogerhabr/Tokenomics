/**
 * Applies every unapplied migration in supabase/migrations, in order.
 *
 * The point of this file is that nobody should ever paste SQL into a dashboard
 * to deploy this site. Set SUPABASE_DB_URL once and the schema follows the
 * repository from then on.
 *
 * Behaviour that matters:
 *
 * - **It no-ops without a connection string.** CI builds and local builds have
 *   no database and must not fail because of it. Absent URL is a skip, not an
 *   error. Pass --require to invert that for a deploy that must migrate.
 * - **Each migration runs in its own transaction**, so a failure leaves the
 *   database on the last good migration rather than half-way through a bad one.
 * - **A session advisory lock** serialises concurrent runs — two Vercel builds
 *   finishing together would otherwise race to apply the same file.
 * - **Checksums are recorded.** Editing a migration that has already been
 *   applied is drift, not a change; it fails loudly rather than silently
 *   diverging from what is actually in the database.
 *
 * Usage:
 *   node scripts/migrate.mjs            # apply, skip if unconfigured
 *   node scripts/migrate.mjs --require  # fail if unconfigured
 *   node scripts/migrate.mjs --dry-run  # report what would run
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DIR = path.join(process.cwd(), 'supabase', 'migrations');
const LOCK_KEY = 8_147_236_591; // arbitrary, but stable across runs

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const required = args.has('--require');

// Supabase exposes the pooled connection string under a few names depending on
// where you copy it from; accept the common ones rather than insisting on one.
const url =
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!url) {
  const message =
    'No database URL (SUPABASE_DB_URL / POSTGRES_URL / DATABASE_URL). Skipping migrations.';
  if (required) {
    console.error(`migrate: ${message}`);
    process.exit(1);
  }
  console.log(`migrate: ${message}`);
  process.exit(0);
}

function migrations() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // 0001_, 0002_, … filenames are the ordering contract
    .map((name) => {
      const sql = readFileSync(path.join(DIR, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

// Supabase terminates TLS with a certificate this client has no root for, so
// verification is relaxed there — the connection is still encrypted. A local
// database has no TLS at all and must not have it forced on.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.includes('host=/');

const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  statement_timeout: 120_000,
});

let locked = false;
try {
  await client.connect();

  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  locked = true;

  const { rows } = await client.query('select name, checksum from public.schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  const all = migrations();
  const drifted = all.filter((m) => applied.has(m.name) && applied.get(m.name) !== m.checksum);

  if (drifted.length > 0) {
    console.error(
      'migrate: these migrations were edited after being applied:\n' +
        drifted.map((m) => `  - ${m.name}`).join('\n') +
        '\nWrite a new migration instead — editing an applied one silently diverges the\n' +
        'database from the repository.'
    );
    process.exitCode = 1;
  } else {
    const pending = all.filter((m) => !applied.has(m.name));

    if (pending.length === 0) {
      console.log(`migrate: up to date (${all.length} applied).`);
    } else if (dryRun) {
      console.log('migrate: would apply:\n' + pending.map((m) => `  - ${m.name}`).join('\n'));
    } else {
      for (const m of pending) {
        process.stdout.write(`migrate: applying ${m.name} … `);
        try {
          await client.query('begin');
          await client.query(m.sql);
          await client.query(
            'insert into public.schema_migrations (name, checksum) values ($1, $2)',
            [m.name, m.checksum]
          );
          await client.query('commit');
          console.log('ok');
        } catch (err) {
          await client.query('rollback').catch(() => {});
          console.log('failed');
          console.error(`migrate: ${m.name} failed — ${err.message}`);
          console.error('The database is unchanged by this migration.');
          process.exitCode = 1;
          break;
        }
      }
    }
  }

  // Promote configured administrators. This is the other step that would
  // otherwise be a hand-written UPDATE, and it is idempotent.
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0 && !dryRun && process.exitCode !== 1) {
    const result = await client.query(
      `update public.profiles
         set role = 'admin'
       where lower(email) = any($1::text[])
         and role is distinct from 'admin'
       returning email`,
      [adminEmails]
    );
    if (result.rowCount > 0) {
      console.log(`migrate: promoted to admin — ${result.rows.map((r) => r.email).join(', ')}`);
    } else {
      console.log('migrate: admin roles already correct (or those users have not signed up yet).');
    }
  }
} catch (err) {
  console.error(`migrate: ${err.message}`);
  process.exitCode = required ? 1 : 0;
  if (!required) console.error('migrate: continuing without migrating.');
} finally {
  if (locked) await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  await client.end().catch(() => {});
}
