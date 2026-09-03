import Link from 'next/link';
import type { ReactNode } from 'react';

/* ===========================================================================
   Layout
   =========================================================================== */

/**
 * A percentage container, so gutters grow with the viewport instead of pinning
 * at a fixed padding. Three container roles exist and they are never mixed:
 * `measure` for prose, `content` for tables and plots, and full-bleed for ink
 * registers and the research-use notice.
 */
export function Container({
  children,
  className = '',
  width = 'content',
}: {
  children: ReactNode;
  className?: string;
  width?: 'content' | 'measure';
}) {
  return (
    <div
      className={`mx-auto w-[88%] ${width === 'measure' ? 'max-w-measure' : 'max-w-content'} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Vertical rhythm in baseline multiples. Generous — roughly 1.5x the old
 * py-16/24 — because the "2000s" complaint about the previous build was as
 * much a density complaint as a style one. Not larger than this: past ~104px
 * the space stops reading as air and starts reading as a gap where something
 * failed to load.
 */
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
    <section id={id} className={`py-[78px] lg:py-[104px] ${className}`}>
      {children}
    </section>
  );
}

/**
 * The rail. Columns 1–2 at desktop carry the section numeral, catalogue
 * number and marginal notes; the body runs beside it. Below 1100px the rail
 * collapses to a running-head strip above the content rather than eating half
 * a four-column viewport.
 */
export function Rail({
  label,
  index,
  children,
  className = '',
}: {
  label?: string;
  index?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-x-[39px] gap-y-[13px] lg:grid-cols-[130px_minmax(0,1fr)] ${className}`}>
      <div className="t-rail flex gap-[13px] text-axis-ink-300 lg:flex-col lg:gap-[4px] lg:pt-[6px]">
        {index && <span aria-hidden="true">{index}</span>}
        {label && <span>{label}</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ===========================================================================
   The spec line
   =========================================================================== */

/**
 * The site's recurring graphic — a dashed hairline drawn at a constant
 * position under every page head and above every table header, and at exactly
 * the 99.0% coordinate on every purity plot.
 *
 * It draws itself left to right on a view() timeline, which is the entire
 * motion signature: a plotter, not a fade-up.
 */
export function Rule({
  label,
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="spec-rule draw" />
      {label && <div className="t-1 mt-[8px] text-axis-ink-300">{label}</div>}
    </div>
  );
}

/* ===========================================================================
   Page head
   =========================================================================== */

export function PageHead({
  index,
  rail,
  title,
  standfirst,
  children,
}: {
  index?: string;
  rail: string;
  title: string;
  standfirst?: string;
  children?: ReactNode;
}) {
  return (
    <header className="pt-[52px] lg:pt-[78px]">
      <Container>
        <Rail label={rail} index={index}>
          <h1 className="t-7 max-w-[18ch] text-axis-ink">{title}</h1>
          {standfirst && (
            <p className="t-5 mt-[26px] max-w-[54ch] text-axis-ink-500">{standfirst}</p>
          )}
          {children}
          <Rule className="mt-[39px]" />
        </Rail>
      </Container>
    </header>
  );
}

export function SectionHead({
  index,
  rail,
  title,
  standfirst,
}: {
  index?: string;
  rail?: string;
  title: string;
  standfirst?: string;
}) {
  return (
    <>
      <Rail label={rail} index={index}>
        <h2 className="t-6 max-w-[22ch] text-axis-ink">{title}</h2>
        {standfirst && (
          <p className="t-4 mt-[13px] max-w-measure text-axis-ink-500">{standfirst}</p>
        )}
        <Rule className="mt-[26px]" />
      </Rail>
    </>
  );
}

/* ===========================================================================
   Controls
   =========================================================================== */

/**
 * Everything on this site is a hairline except one element: the primary order
 * control. Filling it with INK rather than a colour keeps the no-accent
 * discipline intact while still making the buy path the only solid object on
 * the page.
 */
export function OrderButton({
  children,
  type = 'submit',
  disabled,
  className = '',
  onClick,
}: {
  children: ReactNode;
  type?: 'submit' | 'button';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`t-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-plate bg-axis-ink px-[26px] text-axis-paper transition-colors duration-[--dur-1] hover:bg-axis-ink-700 disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The same filled treatment as OrderButton, for when the action is a
 * navigation rather than a submit. Kept as a separate component because
 * nesting a <button> inside a <Link> is invalid HTML — interactive content
 * inside interactive content — and screen readers announce it inconsistently.
 */
export function OrderLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`t-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-plate bg-axis-ink px-[26px] text-axis-paper transition-colors duration-[--dur-1] hover:bg-axis-ink-700 ${className}`}
    >
      {children}
    </Link>
  );
}

/** Every other action on the site: a hairline, never a fill. */
export function HairlineLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`t-3 inline-flex min-h-[44px] items-center gap-[8px] rounded-plate border border-axis-rule-3 px-[20px] text-axis-ink transition-colors duration-[--dur-1] hover:bg-axis-sunk ${className}`}
    >
      {children}
    </Link>
  );
}

/** An inline text link with the house arrow glyph. */
export function ArrowLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`t-3 inline-flex items-center gap-[8px] text-axis-ink underline decoration-axis-rule-3 underline-offset-[5px] transition-colors duration-[--dur-1] hover:decoration-axis-ink ${className}`}
    >
      {children}
      <span aria-hidden="true" className="data">
        →
      </span>
    </Link>
  );
}

/* ===========================================================================
   Data
   =========================================================================== */

export type SourceKind = 'reference' | 'lot' | 'unconfirmed';

export type DataRow = {
  label: string;
  /** Omit for an unconfirmed field — the row prints its reason instead. */
  value?: ReactNode;
  source: SourceKind;
  /** Where the value came from — a registry citation, or the certificate the
   *  measurement is recorded on. Required when the row carries a value, so no
   *  figure is ever shown unattributed. (No example lot code here on purpose:
   *  scripts/check-no-fabricated-data.mjs treats one as a build failure.) */
  sourceRef?: string;
  /** Why the value is absent. Shown in place of the value. */
  reason?: string;
};

/**
 * A ruled definition list. Two things make it the credibility asset rather
 * than a spec table:
 *
 *  - Provenance never mixes. A row is tagged reference (a public registry
 *    value for the molecule) or lot (a measurement from our own certificate),
 *    and the two are rendered in separately-headed blocks.
 *  - A field we cannot confirm is TYPESET, not hidden. A printed null with its
 *    reason is worth more than a blank, an em-dash, or an invented figure.
 */
export function DataList({ rows, className = '' }: { rows: DataRow[]; className?: string }) {
  return (
    <dl className={`border-t border-axis-rule-2 ${className}`}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-x-[26px] gap-y-[4px] border-b border-axis-rule-1 py-[13px] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
        >
          <dt className="t-1 text-axis-ink-300">{row.label}</dt>
          <dd className="min-w-0">
            {row.value !== undefined ? (
              <span className="t-2 text-axis-ink">{row.value}</span>
            ) : (
              <span className="t-2 text-axis-ink-500">
                {row.reason ?? 'Not confirmed.'}
              </span>
            )}
            {row.sourceRef && (
              <span className="t-1 mt-[4px] block text-axis-ink-300">{row.sourceRef}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Lot status. Encoded redundantly — glyph, label and colour — so it survives
 * greyscale print, colour-vision deficiency, and WCAG 1.4.1.
 */
export function StatusChip({ status }: { status: 'released' | 'retained' | 'rejected' }) {
  const spec = {
    released: { glyph: '●', label: 'Released', color: 'text-axis-released' },
    retained: { glyph: '○', label: 'Retained', color: 'text-axis-retained' },
    rejected: { glyph: '⊘', label: 'Rejected', color: 'text-axis-rejected' },
  }[status];

  return (
    <span className={`t-1 inline-flex items-center gap-[6px] ${spec.color}`}>
      <span aria-hidden="true">{spec.glyph}</span>
      {spec.label}
    </span>
  );
}

/**
 * The molecular formula at display size with real subscripts. Sixteen unique,
 * chemically true hero images that need no asset pipeline and cannot be wrong —
 * and because it is a text node, it is also the LCP element.
 */
export function Specimen({
  formula,
  className = '',
}: {
  formula: string;
  className?: string;
}) {
  // "C62H98N16O22" -> C₆₂H₉₈N₁₆O₂₂, with the digits as real <sub> elements so
  // the string stays selectable and readable to assistive tech.
  const parts = formula.match(/[A-Z][a-z]?|\d+|./g) ?? [];

  // Formulas run from 10 characters (C32H49N9O5) to 16 (C194H312N54O59S2), and
  // at a fixed display size the long ones overflow the column and collide with
  // the order panel. Rather than shrink every specimen to fit the worst case,
  // cap the size against the container's own width: digits are subscripted at
  // 0.55em and the mono advance is ~0.62em, so this is the largest size at
  // which THIS formula still fits on one line.
  const letters = (formula.match(/[A-Za-z]/g) ?? []).length;
  const digits = (formula.match(/\d/g) ?? []).length;
  const others = formula.length - letters - digits;
  const emWidth = (letters + others + digits * 0.55) * 0.62;
  const capCqi = (100 / emWidth).toFixed(2);

  return (
    <div style={{ containerType: 'inline-size' }} className={className}>
      <p
        className="t-8 text-axis-ink"
        style={{ fontSize: `min(var(--fs-8), ${capCqi}cqi)` }}
        aria-label={`Molecular formula ${formula}`}
      >
        {parts.map((part, i) =>
          /^\d+$/.test(part) ? (
            <sub key={i} className="text-[0.55em]">
              {part}
            </sub>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
    </div>
  );
}

/* ===========================================================================
   The research-use notice
   =========================================================================== */

/**
 * Set for PROMINENCE, not distinctiveness. This is the legally most important
 * sentence on the site, so it is rendered at reading size in the reading flow —
 * not demoted to 11px uppercase mono in a tinted rounded panel.
 */
export function ResearchNotice({ className = '' }: { className?: string }) {
  return (
    <aside
      className={`border-y border-axis-rejected py-[26px] ${className}`}
      aria-label="Research use only notice"
    >
      <Container>
        <p className="t-3 max-w-measure text-axis-ink">
          <span className="t-1 mb-[8px] block text-axis-rejected">For research use only</span>
          All materials supplied by Axis Labs are intended solely for laboratory research and in
          vitro study. They are not drugs, foods, cosmetics, or medical devices, and are not for
          human or veterinary consumption, clinical use, or diagnostic application.
        </p>
      </Container>
    </aside>
  );
}
