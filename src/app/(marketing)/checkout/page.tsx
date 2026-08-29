import type { Metadata } from 'next';
import { Container, PageHead, Section, ResearchNotice } from '@/components/marketing/ui';
import CheckoutForm from '@/components/marketing/CheckoutForm';

export const metadata: Metadata = {
  title: 'Place your order — Axis Labs',
  description:
    'Place a research compound order with Axis Labs. No payment is taken on this site; we confirm stock, allocate a lot, and invoice with the certificate of analysis.',
};

export default function CheckoutPage() {
  return (
    <>
      <PageHead
        index="01"
        rail="Order"
        title="Place your order."
        standfirst="No payment is taken here. We confirm stock and allocate a lot, then reply by email with an itemised invoice and the certificate of analysis for the material you will receive."
      />
      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <CheckoutForm />
        </Container>
      </Section>
      <ResearchNotice />
    </>
  );
}
