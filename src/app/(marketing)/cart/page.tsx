import type { Metadata } from 'next';
import { Container, PageHead, Section, ResearchNotice } from '@/components/marketing/ui';
import CartView from '@/components/marketing/CartView';

export const metadata: Metadata = {
  title: 'Your order — Axis Labs',
  description: 'Review the research compounds in your Axis Labs order before checkout.',
};

export default function CartPage() {
  return (
    <>
      <PageHead
        index="01"
        rail="Order"
        title="Your order."
        standfirst="Review quantities before you continue. Nothing is charged on this site — we confirm stock, allocate a lot, and invoice you with the certificate."
      />
      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <CartView />
        </Container>
      </Section>
      <ResearchNotice />
    </>
  );
}
