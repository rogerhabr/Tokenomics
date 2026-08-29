import HelixMark from './HelixMark';

type LogoProps = {
  /** Show the "ADVANCING PEPTIDE RESEARCH" tagline beneath the wordmark. */
  withTagline?: boolean;
  /**
   * Show the helix mark beside the wordmark. Off by default: the supplied
   * artwork is a wordmark lockup, with the helix as a separate mark, so the
   * nav and footer reproduce the lockup on its own.
   */
  withMark?: boolean;
  /** Render light-on-dark (for the navy footer). */
  inverted?: boolean;
  className?: string;
};

/**
 * AXIS LABS identity — an SVG reconstruction of the supplied logo: the
 * royal-blue "AXIS LABS" wordmark over a deeper navy tagline.
 *
 * To drop in the original artwork instead, swap the spans below for an <img> of
 * the supplied lockup. Every surface of the site renders its logo through this
 * one component, so nothing else needs touching.
 */
export default function Logo({
  withTagline = true,
  withMark = false,
  inverted = false,
  className = '',
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {withMark && <HelixMark size={40} inverted={inverted} idPrefix="axis-logo-helix" />}
      <span className="flex flex-col leading-none">
        <span
          className="text-[22px] font-extrabold uppercase leading-none tracking-[0.01em]"
          style={{ color: inverted ? '#FFFFFF' : '#2E4C9E' }}
        >
          Axis Labs
        </span>
        {withTagline && (
          <span
            className="mt-[5px] text-[8.5px] font-bold uppercase leading-none tracking-[0.115em]"
            style={{ color: inverted ? '#8FBEEA' : '#1B2A63' }}
          >
            Advancing Peptide Research
          </span>
        )}
      </span>
    </span>
  );
}
