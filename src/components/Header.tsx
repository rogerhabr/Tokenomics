'use client';

import { useGlobalParams } from '@/contexts/ParamsContext';
import { useLiveData } from '@/hooks/useLiveData';

interface HeaderProps {
  activeSection: string;
  sections: { id: string; label: string; icon: string }[];
  onMenuClick?: () => void;
  onLogout?: () => void;
}

export default function Header({ activeSection, sections, onMenuClick, onLogout }: HeaderProps) {
  const current = sections.find(s => s.id === activeSection);
  const { setPanelOpen } = useGlobalParams();
  const { liveData, liveLoaded } = useLiveData();

  const updatedLabel = liveLoaded && liveData.lastUpdated
    ? `Live data: ${new Date(liveData.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'Live data: loading…';

  return (
    <header className="fixed top-0 left-0 right-0 md:left-64 h-14 bg-sa-surface border-b border-sa-border flex items-center px-4 md:px-6 z-10">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden mr-3 p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor" />
          <rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor" />
          <rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor" />
        </svg>
      </button>

      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg hidden sm:block">{current?.icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white leading-none truncate">
            {current?.label}
          </h2>
          <p className="text-xs text-sa-muted mt-0.5 hidden sm:block">
            AI Tokenomics Model · Actual data cited · Forecasts labeled
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <span className="text-xs text-sa-muted hidden lg:block">{updatedLabel}</span>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg bg-sa-card border border-sa-border text-xs font-medium text-slate-400 hover:text-white hover:border-sa-accent transition-colors"
        >
          <span>⚙</span>
          <span className="hidden sm:inline">Tune Model</span>
        </button>
        <div className="flex items-center gap-1.5" title={`CapEx: SEC EDGAR 10-K (daily) · Stocks: Yahoo Finance · GPU pricing: Azure & Lambda APIs · Model pricing: curated API docs`}>
          <span className="w-2 h-2 rounded-full bg-sa-green animate-pulse" />
          <span className="text-xs text-sa-green font-medium hidden sm:inline">
            {liveLoaded ? 'SEC EDGAR · Daily' : 'Live data…'}
          </span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-2.5 md:px-3 py-1.5 rounded-lg bg-sa-card border border-sa-border text-xs font-medium text-slate-400 hover:text-white hover:border-sa-accent transition-colors"
          >
            Log out
          </button>
        )}
      </div>
    </header>
  );
}
