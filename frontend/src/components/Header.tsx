import React from 'react';
import { RefreshCw, LayoutGrid, Store, Clock } from 'lucide-react';

interface HeaderProps {
  backendOnline: boolean;
  isPolling: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  activeTab: 'dashboard' | 'demo_store';
  onSelectTab: (tab: 'dashboard' | 'demo_store') => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendOnline,
  isPolling,
  lastUpdated,
  onRefresh,
  activeTab,
  onSelectTab,
}) => {
  const formattedDate = lastUpdated
    ? lastUpdated.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' ' +
      lastUpdated.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'May 16, 2025 01:31 PM';

  return (
    <header className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#EFEAE2] bg-[#FAF7F2]">
      {/* Mode Navigation Tabs */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
            activeTab === 'dashboard'
              ? 'bg-[#D95A1E] text-white shadow-sm'
              : 'bg-white text-stone-700 hover:bg-stone-50 border border-[#E7E2D9]'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>SRE Control Plane</span>
        </button>

        <button
          onClick={() => onSelectTab('demo_store')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
            activeTab === 'demo_store'
              ? 'bg-[#D95A1E] text-white shadow-sm'
              : 'bg-white text-stone-700 hover:bg-stone-50 border border-[#E7E2D9]'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Live Mini-Store Demo</span>
        </button>
      </div>

      {/* Live System Status Indicators */}
      <div className="flex items-center space-x-5 text-xs font-medium text-stone-700">
        {/* API Connected Status */}
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? 'bg-[#2E7D32]' : 'bg-[#D32F2F]'
            }`}
          />
          <span className="font-semibold text-stone-800">
            {backendOnline ? 'API Connected' : 'API Disconnected'}
          </span>
        </div>

        {/* Date Time */}
        <div className="flex items-center space-x-1.5 text-stone-600">
          <Clock className="w-3.5 h-3.5 text-stone-500" />
          <span className="font-medium">{formattedDate}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Refresh telemetry"
          className="p-1.5 rounded-full hover:bg-stone-200/60 text-stone-600 hover:text-stone-900 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-[#D95A1E]' : ''}`} />
        </button>
      </div>
    </header>
  );
};
