import HelixMark from './HelixMark';

/**
 * AXIS LABS identity — the helix mark beside the royal-blue wordmark over a
 * deeper navy tagline, reconstructed from the supplied artwork.
 *
 * The rest of the marketing surface carries no decorative colour: colour there
 * means a lot passed, was retained, or was rejected. The logo is the one
 * deliberate exception, because it is identity rather than interface — it
 * matches the physical artwork on the packaging. To drop in the original files
 * instead, swap the mark and spans below for an <img>; every logo on the site
 * renders through this component, so nothing else needs touching.
 */
export default function Logo({
  withTagline = true,
  withMark = true,
  inverted = false,
  /** Mark size in px. The wordmark scales with it. */
  size = 40,
  className = '',
}: {
  withTagline?: boolean;
  /** Show the helix mark. Off where the lockup has to sit in a tight column. */
  withMark?: boolean;
  /** Render light-on-dark, for the ink-band footer. */
  inverted?: boolean;
  size?: number;
  className?: string;
}) {
  // The wordmark is set from the mark's height so the lockup keeps its
  // proportions wherever it is used, rather than needing a second size prop
  // that can drift out of step with the first.
  const word = Math.round(size * 0.7);
  const tagline = Math.max(7, Math.round(size * 0.25));

  return (
    <span className={`inline-flex items-center gap-[10px] ${className}`}>
      {withMark && <HelixMark size={size} inverted={inverted} idPrefix="axis-logo-helix" />}
      <span className="inline-flex flex-col leading-none">
        <span
          className="uppercase leading-none"
          style={{
            fontSize: `${word}px`,
            color: inverted ? '#FFFFFF' : '#2E4C9E',
            fontVariationSettings: "'wght' 700, 'wdth' 100",
            letterSpacing: '0.01em',
          }}
        >
          Axis Labs
        </span>
        {withTagline && (
          <span
            className="uppercase leading-none"
            style={{
              fontSize: `${tagline}px`,
              marginTop: `${Math.round(size * 0.13)}px`,
              color: inverted ? '#8FBEEA' : '#1B2A63',
              fontVariationSettings: "'wght' 600, 'wdth' 100",
              letterSpacing: '0.115em',
            }}
          >
            Advancing Peptide Research
          </span>
        )}
      </span>
    </span>
  );
}
