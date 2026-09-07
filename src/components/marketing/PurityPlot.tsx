import { RELEASE_SPEC_PCT, type Lot } from '@/lib/lots';

/**
 * The purity plot — the site's signature image and the spec line made literal.
 *
 * x = assay date, y = purity %. The release specification is drawn as a dashed
 * hairline straight across; released lots sit above it as filled discs,
 * retained lots as hollow rings, and rejected lots as struck marks visibly
 * BELOW it. The rejections are the point: this is the only asset on the site a
 * competitor cannot copy without also publishing what they failed.
 *
 * Hand-authored inline SVG in a server component — no chart library, no client
 * JavaScript. With no rows it renders an honest empty state and nothing else:
 * never a placeholder curve, never a designed example.
 */

const W = 1000;
const H = 300;
const PAD = { top: 24, right: 24, bottom: 40, left: 52 };

/** Plot floor. Lots below this are clamped to the axis and still readable. */
const Y_MIN = 95;
const Y_MAX = 100;

function purityToY(pct: number): number {
  const clamped = Math.max(Y_MIN, Math.min(Y_MAX, pct));
  const t = (clamped - Y_MIN) / (Y_MAX - Y_MIN);
  return PAD.top + (1 - t) * (H - PAD.top - PAD.bottom);
}

function EmptyState({ scope }: { scope: string }) {
  return (
    <div className="border-y border-axis-rule-2 py-[20px]">
      <p className="t-2 text-axis-ink-500">
        No assays published for {scope}. The first release record publishes on dispatch.
      </p>
    </div>
  );
}

export default function PurityPlot({
  lots,
  scope = 'this compound',
}: {
  lots: Lot[];
  scope?: string;
}) {
  const plotted = lots.filter((l) => l.purityPct !== null && l.assayDate !== null);
  if (plotted.length === 0) return <EmptyState scope={scope} />;

  const times = plotted.map((l) => new Date(l.assayDate as string).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const span = maxT - minT || 1;

  const dateToX = (iso: string) => {
    const t = (new Date(iso).getTime() - minT) / span;
    // A single-point series sits centred rather than pinned to the left axis.
    const usable = W - PAD.left - PAD.right;
    return plotted.length === 1 ? PAD.left + usable / 2 : PAD.left + t * usable;
  };

  const specY = purityToY(RELEASE_SPEC_PCT);
  const gridlines = [95, 96, 97, 98, 99, 100];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-axis-ink"
        role="img"
        aria-label={`Purity of every published lot against the ${RELEASE_SPEC_PCT}% release specification. ${plotted.length} assays plotted.`}
      >
        {/* y-axis gridlines and labels */}
        {gridlines.map((pct) => (
          <g key={pct}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={purityToY(pct)}
              y2={purityToY(pct)}
              stroke="var(--rule-1)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={purityToY(pct) + 4}
              textAnchor="end"
              className="data"
              fontSize={11}
              fill="var(--ink-300)"
            >
              {pct}
            </text>
          </g>
        ))}

        {/* The spec line. Positioned by the same purityToY() that positions
            every mark, so the line and the data can never drift apart. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={specY}
          y2={specY}
          stroke="var(--rule-3)"
          strokeWidth={1}
          strokeDasharray="6 5"
        />
        <text
          x={W - PAD.right}
          y={specY - 9}
          textAnchor="end"
          className="data"
          fontSize={11}
          fill="var(--ink-500)"
        >
          ≥{RELEASE_SPEC_PCT.toFixed(1)}% RELEASE SPECIFICATION
        </text>

        {/* Lot marks */}
        {plotted.map((lot) => {
          const x = dateToX(lot.assayDate as string);
          const y = purityToY(lot.purityPct as number);
          const common = { cx: x, cy: y, r: 5 };
          return (
            <g key={lot.lotCode}>
              {lot.status === 'released' && <circle {...common} fill="var(--released)" />}
              {lot.status === 'retained' && (
                <circle {...common} fill="none" stroke="var(--retained)" strokeWidth={1.75} />
              )}
              {lot.status === 'rejected' && (
                <>
                  <circle {...common} fill="none" stroke="var(--rejected)" strokeWidth={1.75} />
                  <line
                    x1={x - 7}
                    x2={x + 7}
                    y1={y}
                    y2={y}
                    stroke="var(--rejected)"
                    strokeWidth={1.75}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* x-axis */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--rule-2)"
          strokeWidth={1}
        />
      </svg>

      <figcaption className="t-1 mt-[13px] flex flex-wrap gap-x-[26px] gap-y-[4px] text-axis-ink-300">
        <span>
          <span aria-hidden="true" className="text-axis-released">
            ●
          </span>{' '}
          Released
        </span>
        <span>
          <span aria-hidden="true" className="text-axis-retained">
            ○
          </span>{' '}
          Retained
        </span>
        <span>
          <span aria-hidden="true" className="text-axis-rejected">
            ⊘
          </span>{' '}
          Rejected
        </span>
        <span>{plotted.length} assays plotted</span>
      </figcaption>
    </figure>
  );
}
