import type { Metadata } from 'next';
import Link from 'next/link';
import PolicyPage from '@/components/marketing/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy | Axis Labs',
  description:
    'What data the Axis Labs site collects, where it is stored, how long it is kept, and how to have it removed.',
};

/**
 * Written from what the code actually does rather than from a template. Every
 * claim below is checkable against this repository: the contact and order
 * routes, the Supabase schema, the rate limiter, and the absence of any
 * analytics or third-party embed.
 */
const SECTIONS = [
  {
    n: '01',
    title: 'What this site collects',
    body: [
      'The enquiry form collects the name, email address, optional organisation, and message you type into it. The order form collects your name, email address, optional organisation and phone number, the shipping address you supply, any order notes, and the compounds and quantities in your order.',
      'That is the complete list. This site has no analytics, no advertising pixels, no session recording, no chat widget, and no third-party embeds of any kind.',
    ],
  },
  {
    n: '02',
    title: 'What is stored in your browser',
    body: [
      'Your order is held in your own browser’s local storage under the key axis-labs-cart-v1, and only as a list of variant identifiers and quantities — no names, no prices. It never leaves your device until you place an order, and clearing your browser data removes it.',
      'We set no advertising or analytics cookies. A session cookie is used only if you sign in to the private area of this site, which is not part of the storefront.',
    ],
  },
  {
    n: '03',
    title: 'Where it is stored',
    body: [
      'Enquiries and orders are stored in a Postgres database hosted by Supabase, under row-level security policies that prevent one visitor from reading another’s record. Orders cannot be listed or read back through the public site at all — the confirmation page shows your reference from the response to your own request, not from a lookup.',
      'The site is hosted on Vercel, which processes request logs including IP addresses as part of operating the service.',
    ],
  },
  {
    n: '04',
    title: 'Abuse prevention',
    body: [
      'API requests are rate-limited. The limiter identifies a request by its IP address, holds that value transiently, and stores no other information about it.',
      'Both forms carry a hidden field that people never see and automated submissions usually fill. Submissions that fill it are discarded.',
    ],
  },
  {
    n: '05',
    title: 'Error reporting',
    body: [
      'If error tracking is enabled for this deployment, uncaught application errors are reported to Sentry to be diagnosed. Those reports can include the URL you were on and technical details of the failure.',
    ],
  },
  {
    n: '06',
    title: 'How long it is kept, and your rights',
    body: [
      'Enquiries and orders are retained for as long as we need them to answer you, fulfil the order, and meet our record-keeping obligations.',
      'You can ask us what we hold about you, ask for it to be corrected, or ask for it to be deleted. Write to us and we will action it.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      rail="Policy"
      title="Privacy."
      standfirst="A short policy, because this site collects very little. No analytics, no advertising pixels, no third-party embeds — the only data we hold is what you type into a form."
      sections={SECTIONS}
      footnote={
        <p className="t-3 text-axis-ink-500">
          To make a request about your data, or to ask how a specific field is handled,{' '}
          <Link href="/contact" className="text-axis-ink underline underline-offset-[4px]">
            contact us
          </Link>
          . The operating entity, its registered address, and the supervisory authority for your
          territory are confirmed on request and on every invoice.
        </p>
      }
    />
  );
}
