'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AssumptionsPanel from '@/components/AssumptionsPanel';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import LoginGate from '@/components/LoginGate';
import { ParamsProvider } from '@/contexts/ParamsContext';

const LOADING = () => (
  <div className="flex items-center justify-center h-48 text-sa-muted text-sm animate-pulse">
    Loading section…
  </div>
);

const Overview               = dynamic(() => import('@/components/sections/Overview'),                { ssr: false, loading: LOADING });
const HardwareInstalledBase  = dynamic(() => import('@/components/sections/HardwareInstalledBase'),   { ssr: false, loading: LOADING });
const TokenThroughput        = dynamic(() => import('@/components/sections/TokenThroughput'),         { ssr: false, loading: LOADING });
const ComputeSupplyDemand    = dynamic(() => import('@/components/sections/ComputeSupplyDemand'),     { ssr: false, loading: LOADING });
const SaasDisruption         = dynamic(() => import('@/components/sections/SaasDisruption'),          { ssr: false, loading: LOADING });
const AddressableMarket      = dynamic(() => import('@/components/sections/AddressableMarket'),       { ssr: false, loading: LOADING });
const TokenPricingTrends     = dynamic(() => import('@/components/sections/TokenPricingTrends'),      { ssr: false, loading: LOADING });
const FoundationLabFinancials= dynamic(() => import('@/components/sections/FoundationLabFinancials'), { ssr: false, loading: LOADING });
const ROICCalculator              = dynamic(() => import('@/components/sections/ROICCalculator'),               { ssr: false, loading: LOADING });
const HardwareDemandForecast      = dynamic(() => import('@/components/sections/HardwareDemandForecast'),        { ssr: false, loading: LOADING });
const HardwareRefreshSensitivity  = dynamic(() => import('@/components/sections/HardwareRefreshSensitivity'),    { ssr: false, loading: LOADING });
const RevenueProfit               = dynamic(() => import('@/components/sections/RevenueProfit'),                 { ssr: false, loading: LOADING });
const TokenCostAnatomy            = dynamic(() => import('@/components/sections/TokenCostAnatomy'),              { ssr: false, loading: LOADING });
const WorkflowAllocation          = dynamic(() => import('@/components/sections/WorkflowAllocation'),            { ssr: false, loading: LOADING });
const DataCenterCostBreakdown     = dynamic(() => import('@/components/sections/DataCenterCostBreakdown'),        { ssr: false, loading: LOADING });
const ScenarioBar            = dynamic(() => import('@/components/ScenarioBar'),                       { ssr: false });
const DataSources            = dynamic(() => import('@/components/sections/DataSources'),               { ssr: false, loading: LOADING });

const SECTIONS = [
  { id: 'overview',            label: 'Overview',                icon: '🏠', group: 'Dashboard' },
  { id: 'hardware-base',       label: 'Hardware Installed Base', icon: '🖥️', group: 'Supply' },
  { id: 'token-throughput',    label: 'Token Throughput',        icon: '⚡', group: 'Supply' },
  { id: 'supply-demand',       label: 'Compute Supply & Demand', icon: '⚖️', group: 'Supply' },
  { id: 'saas-disruption',     label: 'SAAS Disruption',         icon: '🔄', group: 'Demand' },
  { id: 'addressable-market',  label: 'Addressable Market',      icon: '🌐', group: 'Demand' },
  { id: 'token-pricing',       label: 'Token Pricing Trends',    icon: '📉', group: 'Demand' },
  { id: 'lab-financials',      label: 'Lab Financials',          icon: '🏦', group: 'Demand' },
  { id: 'roic-calculator',     label: 'ROIC Calculator',         icon: '🧮', group: 'Economics' },
  { id: 'hardware-refresh',    label: 'HW Refresh Sensitivity',  icon: '🔄', group: 'Economics' },
  { id: 'hardware-demand',     label: 'Hardware Demand Forecast',icon: '📦', group: 'Economics' },
  { id: 'revenue-profit',      label: 'Revenue & Profit',        icon: '💰', group: 'Economics' },
  { id: 'dc-cost-breakdown',   label: 'AI Data Center Costs',    icon: '🏭', group: 'Economics' },
  { id: 'token-cost',          label: 'Token Cost Anatomy',      icon: '🧬', group: 'Tokenomics' },
  { id: 'workflow-allocation', label: 'Workflow Allocation',     icon: '🕸️', group: 'Tokenomics' },
  { id: 'data-sources',        label: 'Data Sources',            icon: '🔍', group: 'Methodology' },
];

function SectionContent({ id }: { id: string }) {
  switch (id) {
    case 'overview':           return <Overview />;
    case 'hardware-base':      return <HardwareInstalledBase />;
    case 'token-throughput':   return <TokenThroughput />;
    case 'supply-demand':      return <ComputeSupplyDemand />;
    case 'saas-disruption':    return <SaasDisruption />;
    case 'addressable-market': return <AddressableMarket />;
    case 'token-pricing':      return <TokenPricingTrends />;
    case 'lab-financials':     return <FoundationLabFinancials />;
    case 'roic-calculator':    return <ROICCalculator />;
    case 'hardware-refresh':   return <HardwareRefreshSensitivity />;
    case 'hardware-demand':    return <HardwareDemandForecast />;
    case 'revenue-profit':     return <RevenueProfit />;
    case 'dc-cost-breakdown':  return <DataCenterCostBreakdown />;
    case 'token-cost':         return <TokenCostAnatomy />;
    case 'workflow-allocation':return <WorkflowAllocation />;
    case 'data-sources':       return <DataSources />;
    default:                   return null;
  }
}

export default function Home() {
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <LoginGate>
      {logout => (
        <ParamsProvider activeSection={active} onNavigate={setActive}>
          <div className="flex min-h-screen bg-sa-bg">
            <Sidebar
              sections={SECTIONS}
              active={active}
              onSelect={setActive}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
            <div className="flex-1 md:ml-64">
              <Header
                activeSection={active}
                sections={SECTIONS}
                onMenuClick={() => setSidebarOpen(true)}
                onLogout={logout}
              />
              <ScenarioBar />
              <main className="pt-24 min-h-screen">
                <div className="p-4 md:p-6 max-w-7xl">
                  <SectionErrorBoundary key={active}>
                    <SectionContent id={active} />
                  </SectionErrorBoundary>
                </div>
              </main>
            </div>
          </div>
          <AssumptionsPanel />
        </ParamsProvider>
      )}
    </LoginGate>
  );
}
