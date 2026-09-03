import inlineSvgs from '@/lib/molecules.svg.json';

const SVGS = inlineSvgs as Record<string, string>;

/**
 * A compound's 2D structure, drawn from PubChem coordinate data in our own line
 * weight by `scripts/fetch-molecules.mjs`.
 *
 * The markup is inlined rather than referenced through `<img>` for two reasons:
 * `currentColor` and `--molecule-hetero` then resolve against the page, so one
 * asset works on paper, on an ink band and in dark mode; and the compiler
 * bundles it, so nothing is read from disk at request time.
 *
 * Only compounds under the atom limit have an entry — above it the drawing is
 * line noise and the formula specimen carries the page instead. Returns null
 * when there is nothing honest to draw.
 */
export default function Structure({
  slug,
  className = '',
  label,
}: {
  slug: string;
  className?: string;
  label?: string;
}) {
  const svg = SVGS[slug];
  if (!svg) return null;

  return (
    <div
      className={className}
      role="img"
      aria-label={label ?? 'Two-dimensional molecular structure'}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
