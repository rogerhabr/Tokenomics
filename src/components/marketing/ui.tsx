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
    <section id={id} className={`scroll-mt-20 py-20 sm:py-28 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-axis-accent">{children}</p>
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
  const alignment = align === 'center' ? 'mx-auto text-center' : '';
  return (
    <div className={`max-w-2xl ${alignment}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-axis-text sm:text-4xl">
        {title}
      </h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-axis-muted">{lede}</p>}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-axis-border bg-axis-card p-6 transition-colors hover:border-axis-border-strong ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
};

export function Button({ href, children, variant = 'primary', className = '' }: ButtonProps) {
  const base =
    'focus-ring inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition-colors';
  const styles =
    variant === 'primary'
      ? 'bg-axis-accent text-white hover:bg-axis-accent-hover'
      : 'border border-axis-border-strong text-axis-text hover:border-axis-accent hover:text-axis-accent';
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
      <Container className="py-20 sm:py-24">
        <div className="max-w-3xl animate-fade-up">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-axis-text sm:text-5xl">
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
    <div className="border-l border-axis-border pl-5">
      <div className="font-mono text-3xl font-semibold tracking-tight text-axis-text">{value}</div>
      <div className="mt-1.5 text-sm text-axis-muted">{label}</div>
    </div>
  );
}
