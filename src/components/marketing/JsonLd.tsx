/**
 * Structured data.
 *
 * Deliberately NOT Product/Offer markup. Shopping surfaces reject this
 * category outright — Google Ads' unapproved-substances policy catches several
 * of these molecules by name, and Merchant Center disallows them independently
 * — so merchandising markup buys no rich result here while asserting a retail
 * framing that works against the research-use position.
 *
 * What we publish instead is chemical identity: MolecularEntity, sourced from a
 * public registry and carrying its identifiers. That is accurate, it is what an
 * AI answer surface can actually cite, and it makes no claim about use.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own catalogue and build-time registry
      // data — no user input reaches it.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
