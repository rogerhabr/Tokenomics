import type { Metadata } from 'next';
import './globals.css';
import { SITE_URL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Axis Labs — Research Compounds, Assayed Against a Published Specification',
    template: '%s',
  },
  description:
    'Axis Labs supplies research compounds for laboratory and in vitro study. Every lot is assayed by an independent laboratory against a published release specification. Research use only.',
  applicationName: SITE_NAME,
  icons: { icon: '/axis-labs-mark.svg' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
