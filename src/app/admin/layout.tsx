import type { ReactNode } from 'react';
import Link from 'next/link';
import { Archivo, Martian_Mono } from 'next/font/google';

/**
 * The admin surface is not part of the (marketing) route group — it has no
 * nav, no footer and no order tray — but it uses the same type and token
 * system so an administrator is looking at the same object the buyer is.
 *
 * Nothing here is added to PUBLIC_PREFIXES in middleware, so /admin stays
 * private by default. That is the intended behaviour: this is the one part of
 * the site that must never be reachable without a session.
 */
const grot = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-grot', display: 'swap' });
const data = Martian_Mono({ subsets: ['latin'], axes: ['wdth'], variable: '--font-data', display: 'swap' });

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${grot.variable} ${data.variable} min-h-screen bg-axis-paper text-axis-ink`}>
      <header className="border-b border-axis-rule-2 bg-axis-sunk">
        <div className="mx-auto flex w-[92%] max-w-content items-center justify-between py-[13px]">
          <span className="t-1 text-axis-ink-300">Axis Labs — administration</span>
          <Link href="/" className="t-2 text-axis-ink underline underline-offset-[4px]">
            Back to the site
          </Link>
        </div>
      </header>
      <main className="mx-auto w-[92%] max-w-content py-[39px]">{children}</main>
    </div>
  );
}
