import type { Metadata } from 'next';
import { Container, PageHero, ResearchNotice } from '@/components/marketing/ui';
import CheckoutForm from '@/components/marketing/CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout — Axis Labs',
  description: 'Complete your Axis Labs research compound order.',
};

export default function CheckoutPage() {
  return (
    <>
      <PageHero
        eyebrow="Checkout"
        title="Complete your order."
        lede="We confirm stock and current batch availability, then send your invoice with a secure payment link and the certificate of analysis for the lot you will receive."
      />
      <Container className="py-12">
        <CheckoutForm />
        <ResearchNotice className="mt-12" />
      </Container>
    </>
  );
}
