import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Axis Labs — The economics of artificial intelligence',
    template: '%s',
  },
  description:
    'Axis Labs builds quantitative models of the AI value chain: hardware installed base, token throughput, unit costs, and returns on invested capital.',
  icons: { icon: '/axis-labs-logo.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
