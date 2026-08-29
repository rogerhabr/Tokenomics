import type { Metadata } from 'next';
import { Container, PageHero, ResearchNotice } from '@/components/marketing/ui';
import CartView from '@/components/marketing/CartView';

export const metadata: Metadata = {
  title: 'Cart — Axis Labs',
  description: 'Review the research compounds in your Axis Labs cart before checkout.',
};

export default function CartPage() {
  return (
    <>
      <PageHero
        eyebrow="Cart"
        title="Your order."
        lede="Review quantities before checkout. All materials are supplied for laboratory research use only."
      />
      <Container className="py-12">
        <CartView />
        <ResearchNotice className="mt-12" />
      </Container>
    </>
  );
}
