import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Axis Labs — Advancing Peptide Research',
    template: '%s',
  },
  description:
    'Axis Labs supplies third-party tested research peptides at 99%+ purity for laboratory and in vitro study. Research use only.',
  icons: { icon: '/axis-labs-mark.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
