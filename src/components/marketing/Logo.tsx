/**
 * AXIS LABS identity — the royal-blue wordmark over a deeper navy tagline,
 * reconstructed from the supplied artwork.
 *
 * The rest of the marketing surface carries no decorative colour: colour there
 * means a lot passed, was retained, or was rejected. The wordmark is the one
 * deliberate exception, because it is identity rather than interface — it
 * matches the physical artwork on the packaging. To drop in the original file
 * instead, swap the spans below for an <img>; every logo on the site renders
 * through this component, so nothing else needs touching.
 */
export default function Logo({
  withTagline = true,
  inverted = false,
  className = '',
}: {
  withTagline?: boolean;
  /** Render light-on-dark, for the ink-band footer. */
  inverted?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        className="text-[19px] uppercase leading-none"
        style={{
          color: inverted ? '#FFFFFF' : '#2E4C9E',
          fontVariationSettings: "'wght' 700, 'wdth' 100",
          letterSpacing: '0.01em',
        }}
      >
        Axis Labs
      </span>
      {withTagline && (
        <span
          className="mt-[5px] text-[7.5px] uppercase leading-none"
          style={{
            color: inverted ? '#8FBEEA' : '#1B2A63',
            fontVariationSettings: "'wght' 600, 'wdth' 100",
            letterSpacing: '0.115em',
          }}
        >
          Advancing Peptide Research
        </span>
      )}
    </span>
  );
}
