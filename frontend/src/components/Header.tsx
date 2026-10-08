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
    <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Mode Switcher */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-['JetBrains_Mono']">
                  RecoverOps
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800 rounded">
                  v0.2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dependency-Aware Incident Recovery Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center space-x-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>SRE Control Plane</span>
            </button>
            <button
              onClick={() => onSelectTab('demo_store')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                activeTab === 'demo_store'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-950/80 border border-rose-800/80 text-rose-300 animate-pulse">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>{activeIncidentsCount} Active Incident{activeIncidentsCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Backend Connection */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">API:</span>
            {backendOnline ? (
              <span className="flex items-center space-x-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span>Offline</span>
              </span>
            )}
          </div>

          {/* Last refreshed + Poll spinner */}
          <div className="flex items-center space-x-2 text-slate-400">
            {lastUpdated && (
              <span>
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={onRefresh}
              title="Refresh telemetry"
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 flex items-center justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
