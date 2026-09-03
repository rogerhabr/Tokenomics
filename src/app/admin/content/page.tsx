import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { CONTENT_FIELDS, getContent } from '@/lib/content';
import ContentEditor from '@/components/admin/ContentEditor';

export const metadata: Metadata = { title: 'Page copy — Axis Labs administration' };
export const dynamic = 'force-dynamic';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
      <h1 className="t-6 text-axis-ink">{title}</h1>
      <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">{body}</p>
      <p className="t-3 mt-[20px]">
        <Link href="/login" className="text-axis-ink underline underline-offset-[4px]">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default async function AdminContentPage() {
  const admin = await requireAdmin();

  if (!admin.ok) {
    if (admin.reason === 'unconfigured') {
      return (
        <Notice
          title="Supabase is not configured."
          body="This deployment has no database credentials, so copy cannot be edited here. The site is rendering the text compiled into the repository."
        />
      );
    }
    if (admin.reason === 'signed-out') {
      return <Notice title="Sign in required." body="This page is for administrators only." />;
    }
    return (
      <Notice
        title="Administrator access required."
        body="Your account is signed in but does not have the admin role. Ask an existing administrator to set profiles.role to 'admin' for your user."
      />
    );
  }

  const content = await getContent();

  // Which strings actually differ from source. Read separately from
  // getContent() because that merges the two and cannot tell them apart.
  const supabase = createClient();
  const { data } = await supabase.from('site_content').select('key');
  const overridden = ((data ?? []) as { key: string }[]).map((r) => r.key);

  return (
    <>
      <h1 className="t-7 text-axis-ink">Page copy</h1>
      <p className="t-4 mt-[20px] max-w-measure text-axis-ink-500">
        Every editable string on the public site. A field you have not touched shows the text from
        the repository; clearing a field restores it. Saving purges the affected pages, so changes
        are live immediately.
      </p>
      <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">
        The research-use notice and the policy pages are not editable here — they are disclosures,
        and they stay in source where a change is reviewed in a diff.
      </p>
      <div className="spec-rule mt-[26px]" />

      <ContentEditor fields={CONTENT_FIELDS} content={content} overridden={overridden} />
    </>
  );
}
