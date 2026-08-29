import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-site px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Section({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 py-16 sm:py-24 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-axis-blue">{children}</p>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  lede,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-axis-navy sm:text-[40px]">
        {title}
      </h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-axis-muted">{lede}</p>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-axis-border bg-axis-card p-6 shadow-[0_1px_2px_rgba(20,32,63,0.04)] transition-shadow hover:shadow-[0_6px_20px_rgba(20,32,63,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'onDark';
  className?: string;
};

export function Button({ href, children, variant = 'primary', className = '' }: ButtonProps) {
  const base =
    'focus-ring inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors';
  const styles = {
    primary: 'bg-axis-blue text-white hover:bg-axis-blue-hover',
    secondary: 'border border-axis-border-strong text-axis-navy hover:border-axis-blue hover:text-axis-blue',
    onDark: 'bg-white text-axis-navy hover:bg-axis-tint-strong',
  }[variant];
  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="border-b border-axis-border bg-axis-surface">
      <Container className="py-14 sm:py-20">
        <div className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-axis-navy sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-axis-muted">{lede}</p>
        </div>
      </Container>
    </div>
  );
}

export function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight text-axis-navy sm:text-4xl">{value}</div>
      <div className="mt-1.5 text-sm text-axis-muted">{label}</div>
    </div>
  );
}

/**
 * Research-use-only notice. This product category is sold strictly for
 * laboratory research, so the disclaimer appears on every page rather than
 * being buried in the footer alone.
 */
export function ResearchNotice({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-axis-border-strong bg-axis-tint px-5 py-4 text-sm leading-relaxed text-axis-navy ${className}`}
    >
      <strong className="font-semibold">For research use only.</strong> All materials supplied by
      Axis Labs are intended solely for laboratory research and in vitro study. They are not
      drugs, foods, cosmetics, or medical devices, and are not for human or veterinary
      consumption or any form of clinical use.
    </div>
  );
}
