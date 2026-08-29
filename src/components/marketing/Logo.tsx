type LogoProps = {
  /** Pixel size of the square mark. */
  size?: number;
  /** Render the "AXIS LABS" wordmark next to the mark. */
  withWordmark?: boolean;
  className?: string;
};

/**
 * Placeholder AXIS LABS identity.
 *
 * This is a stand-in mark, not the real artwork. To swap in the supplied logo,
 * replace the <svg> below (and `public/axis-labs-logo.svg`, used for the
 * favicon and OpenGraph) — every other component consumes this one file.
 */
export default function Logo({ size = 32, withWordmark = true, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="axis-mark-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4F7DFF" />
            <stop offset="1" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
        <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8.5" stroke="#333A49" strokeWidth="1.5" />
        <path d="M9 9 L23 23 M23 9 L9 23" stroke="url(#axis-mark-grad)" strokeWidth="2.75" strokeLinecap="round" />
        <circle cx="16" cy="16" r="4" fill="#08090C" />
        <circle cx="16" cy="16" r="2.5" fill="url(#axis-mark-grad)" />
      </svg>
      {withWordmark && (
        <span className="font-semibold tracking-[0.18em] text-[13px] uppercase text-axis-text">
          Axis Labs
        </span>
      )}
    </span>
  );
}
