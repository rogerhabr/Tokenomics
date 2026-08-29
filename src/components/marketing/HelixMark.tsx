/**
 * The AXIS LABS double-helix mark.
 *
 * Both strands are sine waves about x=32 with amplitude 12, a half period every
 * 13 units, so they cross at y = 6, 19, 32, 45, 58 and reach full separation
 * midway between. Rungs and nodes sit at those widest points. The whole figure
 * is rotated to match the diagonal lean of the supplied logo.
 */
const STRAND_A =
  'M32 6 C44 9, 44 16, 32 19 C20 22, 20 29, 32 32 C44 35, 44 42, 32 45 C20 48, 20 55, 32 58';
const STRAND_B =
  'M32 6 C20 9, 20 16, 32 19 C44 22, 44 29, 32 32 C20 35, 20 42, 32 45 C44 48, 44 55, 32 58';

const RUNG_Y = [12.5, 25.5, 38.5, 51.5];

export default function HelixMark({
  size = 34,
  inverted = false,
  strokeWidth = 3.6,
  className = '',
  idPrefix = 'axis-helix',
}: {
  size?: number;
  inverted?: boolean;
  strokeWidth?: number;
  className?: string;
  idPrefix?: string;
}) {
  const nodeColor = inverted ? '#FFFFFF' : '#1B2A63';
  const rungColor = '#8FBEEA';
  const ringColor = inverted ? '#1B2A63' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={`${idPrefix}-a`} x1="20" y1="6" x2="44" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={inverted ? '#8FBEEA' : '#5C7FD0'} />
          <stop offset="1" stopColor={inverted ? '#5C7FD0' : '#1B2A63'} />
        </linearGradient>
        <linearGradient id={`${idPrefix}-b`} x1="44" y1="6" x2="20" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={inverted ? '#FFFFFF' : '#1B2A63'} />
          <stop offset="1" stopColor={inverted ? '#8FBEEA' : '#2E4C9E'} />
        </linearGradient>
      </defs>

      <g transform="rotate(-30 32 32)">
        <g stroke={rungColor} strokeWidth={strokeWidth * 0.5} strokeLinecap="round">
          {RUNG_Y.map((y) => (
            <path key={y} d={`M23 ${y} L41 ${y}`} />
          ))}
        </g>
        <path d={STRAND_A} stroke={`url(#${idPrefix}-a)`} strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={STRAND_B} stroke={`url(#${idPrefix}-b)`} strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* Beads sit at the points of widest strand separation. They are drawn
            larger than the stroke and ringed in the page colour so they read as
            distinct spheres rather than thickening the strand. */}
        <g fill={nodeColor} stroke={ringColor} strokeWidth={strokeWidth * 0.3}>
          {RUNG_Y.map((y) => (
            <g key={y}>
              <circle cx="23" cy={y} r={strokeWidth * 1.15} />
              <circle cx="41" cy={y} r={strokeWidth * 1.15} />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
