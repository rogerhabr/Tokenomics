import Link from 'next/link';
import { CATEGORIES, formatPrice, fromPriceCents, type Product } from '@/lib/products';
import { bestCentsPerMg, formatPerMg } from '@/lib/pricing';
import { getMolecule } from '@/lib/molecules';

/**
 * The catalogue as a register rather than a grid of cards.
 *
 * Seventeen compounds in a three-column card grid is a wall of near-identical
 * boxes that hides the only attributes a researcher selects on — identity,
 * mass and rate. A ruled table shows all of them at once, sorts, compares, and
 * prints. Adjacent rows share one border so the whole thing reads as a single
 * drawing rather than a stack of objects.
 *
 * On mobile each row becomes a stacked record. Nothing here scrolls
 * horizontally.
 */
export default function Register({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="border-y border-axis-rule-2 py-[52px]">
        <p className="t-4 text-axis-ink">No compounds match that search.</p>
        <p className="t-3 mt-[8px] text-axis-ink-500">
          Try a compound name, an alias such as LY3437943, or a research class.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        Research compounds: identity, molecular mass, and price per milligram.
      </caption>
      <thead>
        <tr className="hidden border-b border-axis-rule-3 lg:table-row">
          <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
            Compound
          </th>
          <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
            Class
          </th>
          <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
            Formula
          </th>
          <th scope="col" className="t-1 py-[10px] pr-[20px] text-right text-axis-ink-300">
            Mass
          </th>
          <th scope="col" className="t-1 py-[10px] pr-[20px] text-right text-axis-ink-300">
            From
          </th>
          <th scope="col" className="t-1 py-[10px] text-right text-axis-ink-300">
            Rate
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => {
          const category = CATEGORIES.find((c) => c.id === p.category);
          const molecule = getMolecule(p.slug);
          const from = fromPriceCents(p.slug);
          const perMg = bestCentsPerMg(p.slug);

          return (
            <tr
              key={p.slug}
              className="register-row block border-b border-axis-rule-1 transition-colors duration-[--dur-1] hover:bg-axis-plate lg:table-row"
            >
              <td className="block py-[13px] pr-[20px] align-top lg:table-cell">
                <Link href={`/products/${p.slug}`} className="rounded-plate">
                  <span className="t-4 block text-axis-ink">{p.name}</span>
                  {p.alias && (
                    <span className="t-2 mt-[2px] block text-axis-ink-500">{p.alias}</span>
                  )}
                </Link>
              </td>

              <td className="block pb-[8px] pr-[20px] align-top lg:table-cell lg:py-[13px]">
                <span className="t-2 text-axis-ink-500">{category?.name}</span>
              </td>

              <td className="block pb-[8px] pr-[20px] align-top lg:table-cell lg:py-[13px]">
                {molecule?.formula ? (
                  <span className="data t-2 text-axis-ink">{molecule.formula}</span>
                ) : (
                  <span className="t-2 text-axis-ink-300">Not confirmed</span>
                )}
              </td>

              <td className="block pb-[8px] align-top lg:table-cell lg:py-[13px] lg:pr-[20px] lg:text-right">
                {molecule?.weight ? (
                  <span className="data t-2 text-axis-ink">{molecule.weight}</span>
                ) : (
                  <span className="t-2 text-axis-ink-300">—</span>
                )}
              </td>

              <td className="block pb-[8px] align-top lg:table-cell lg:py-[13px] lg:pr-[20px] lg:text-right">
                {from !== null ? (
                  <span className="data t-2 text-axis-ink">{formatPrice(from)}</span>
                ) : (
                  <span className="t-2 text-axis-ink-300">On request</span>
                )}
              </td>

              <td className="block pb-[13px] align-top lg:table-cell lg:py-[13px] lg:text-right">
                {perMg !== null ? (
                  <span className="data t-2 text-axis-ink-500">{formatPerMg(perMg)}</span>
                ) : (
                  <span className="t-2 text-axis-ink-300">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * A compact index used on the home page: the same data, fewer columns, and the
 * formula carried at display size so the page has a counter-form rather than a
 * fifth ruled list.
 */
export function RegisterExtract({ products }: { products: Product[] }) {
  return (
    <ul className="border-t border-axis-rule-2">
      {products.map((p) => {
        const molecule = getMolecule(p.slug);
        return (
          <li key={p.slug} className="border-b border-axis-rule-1">
            <Link
              href={`/products/${p.slug}`}
              className="grid items-baseline gap-x-[26px] gap-y-[4px] py-[20px] transition-colors duration-[--dur-1] hover:bg-axis-plate sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <span className="t-5 text-axis-ink">{p.name}</span>
              {molecule?.formula ? (
                <span className="data t-2 text-axis-ink-500">{molecule.formula}</span>
              ) : (
                <span className="t-2 text-axis-ink-300">Formula not confirmed</span>
              )}
              <span aria-hidden="true" className="data t-2 text-axis-ink-300">
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
