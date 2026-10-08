import React from 'react';
import { Activity, RefreshCw, ShieldAlert, Server, LayoutDashboard, ShoppingBag } from 'lucide-react';


interface HeaderProps {
  backendOnline: boolean;
  isPolling: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  activeIncidentsCount: number;
  activeTab: 'dashboard' | 'demo_store';
  onSelectTab: (tab: 'dashboard' | 'demo_store') => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendOnline,
  isPolling,
  lastUpdated,
  onRefresh,
  activeIncidentsCount,
  activeTab,
  onSelectTab,
}) => {
  return (
    <header className="border-b border-[#2D2018] bg-[#1C130D] sticky top-0 z-40 px-6 py-3.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Mode Switcher */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-warm-50 font-['JetBrains_Mono']">
                  RecoverOps
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-brand-900/60 text-brand-300 border border-brand-700/60 rounded font-mono">
                  v0.2.0
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Dependency-Aware Incident Recovery Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center space-x-1 bg-[#261A13] border border-[#3D2B20] p-1 rounded-xl">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                activeTab === 'dashboard'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-[#34241B]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>SRE Control Plane</span>
            </button>
            <button
              onClick={() => onSelectTab('demo_store')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                activeTab === 'demo_store'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-[#34241B]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Live Mini-Store Demo</span>
            </button>
          </nav>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center space-x-4 text-xs font-medium">
          {/* Active Incident Warning */}
          {activeIncidentsCount > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-950/90 border border-rose-700 text-rose-200 animate-pulse font-semibold">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>{activeIncidentsCount} Active Incident{activeIncidentsCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Backend Connection */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#261A13] border border-[#3D2B20]">
            <Server className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400">API:</span>
            {backendOnline ? (
              <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-rose-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span>Offline</span>
              </span>
            )}
          </div>

          {/* Last refreshed + Poll spinner */}
          <div className="flex items-center space-x-2 text-stone-400">
            {lastUpdated && (
              <span className="font-mono text-[11px]">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={onRefresh}
              title="Refresh telemetry"
              className="p-1.5 rounded-md bg-[#261A13] hover:bg-[#34241B] text-stone-300 hover:text-white transition border border-[#3D2B20] flex items-center justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-brand-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
