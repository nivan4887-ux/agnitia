import React from 'react';
import {
  Home,
  AlertOctagon,
  Flame,
  Network,
  ClipboardList,
  RefreshCw,
  LayoutGrid,
  Store,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface HeaderProps {
  activeNav: string;
  onSelectNav: (nav: string) => void;
  activeIncidentsCount: number;
  backendOnline: boolean;
  isPolling: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  activeTab: 'dashboard' | 'demo_store';
  onSelectTab: (tab: 'dashboard' | 'demo_store') => void;
  onOpenSOS?: () => void;
  onOpenInjectFault?: () => void;
  onOpenBackendConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeNav,
  onSelectNav,
  activeIncidentsCount,
  backendOnline,
  isPolling,
  lastUpdated: _lastUpdated,
  onRefresh,
  activeTab,
  onSelectTab,
  onOpenSOS,
  onOpenInjectFault,
  onOpenBackendConfig,
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: AlertOctagon,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
    },
    { id: 'engine', label: 'Recovery', icon: Flame },
    { id: 'integrity', label: 'Integrity', icon: ShieldCheck },
    { id: 'graph', label: 'Graph', icon: Network },
    { id: 'audit', label: 'Audit', icon: ClipboardList },
  ];

  return (
    <header className="bg-[#18110B] text-stone-300 border-b border-[#2C1E16] sticky top-0 z-50 shadow-md backdrop-blur-md">
      {/* Tier 1: Main Control Bar (Brand + Actions) */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-13 gap-2 sm:gap-4">
          {/* Left: Brand Identity & Telemetry Status Pill */}
          <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
            <div
              className="flex items-center space-x-2.5 cursor-pointer select-none shrink-0"
              onClick={() => {
                onSelectNav('overview');
                onSelectTab('dashboard');
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                <img src="/logo.png" alt="BRIDGE Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black text-white tracking-wider font-mono">
                  BRIDGE
                </span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold bg-white/10 text-stone-300 rounded">
                  v1.0
                </span>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-4 w-px bg-stone-700/50" />

            {/* API Connected / Demo Status Pill */}
            <button
              type="button"
              onClick={onOpenBackendConfig}
              className="flex items-center space-x-1.5 bg-[#2A1D15] hover:bg-[#38261b] px-2 sm:px-2.5 py-1 rounded-lg border border-stone-800 transition cursor-pointer text-left shrink-0"
              title="Click to configure backend URL or test latency"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  backendOnline ? 'bg-[#4CAF50] animate-pulse' : 'bg-[#D32F2F]'
                }`}
              />
              <span className="font-semibold text-stone-200 text-xs">
                {backendOnline ? 'Live API' : 'Demo / Offline'}
              </span>
            </button>
          </div>

          {/* Right: Mode Switchers, Fault Triggers, & Telemetry */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Inject Fault Trigger Button */}
            {onOpenInjectFault && (
              <button
                onClick={onOpenInjectFault}
                title="Open Fault & Chaos Injection Suite"
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs uppercase tracking-wide shadow-xs transition cursor-pointer active:scale-95 shrink-0"
              >
                <Flame className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="hidden sm:inline">Inject Error</span>
                <span className="sm:hidden">Inject</span>
              </button>
            )}

            {/* Emergency SOS Trigger Button */}
            {onOpenSOS && (
              <button
                onClick={onOpenSOS}
                title="Trigger Emergency Priority-1 SOS Incident"
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs uppercase tracking-wide shadow-xs transition cursor-pointer active:scale-95 shrink-0"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
                <span className="hidden sm:inline">SOS Alert</span>
                <span className="sm:hidden">SOS</span>
              </button>
            )}

            {/* Mode Switcher Pill Group */}
            <div className="bg-[#261710] p-0.5 rounded-lg border border-stone-800 flex items-center space-x-0.5 shrink-0">
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#EA580C] text-white shadow-xs font-semibold'
                    : 'text-stone-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span className="hidden sm:inline">Console</span>
              </button>

              <button
                onClick={() => onSelectTab('demo_store')}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                  activeTab === 'demo_store'
                    ? 'bg-[#EA580C] text-white shadow-xs font-semibold'
                    : 'text-stone-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Store className="w-3 h-3" />
                <span className="hidden sm:inline">Store</span>
              </button>

              <a
                href={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5174`}
                target="_blank"
                rel="noopener noreferrer"
                title="Launch Standalone Store on Port 5174 (For Laptop 1 / Dual-Screen Demo)"
                className="px-1.5 sm:px-2 py-1 rounded-md text-[11px] font-mono text-stone-400 hover:text-orange-400 hover:bg-white/5 flex items-center space-x-1 transition"
              >
                <span>:5174</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            </div>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              title="Refresh telemetry"
              className="p-1.5 rounded-lg bg-[#2A1D15] hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 transition cursor-pointer shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-[#D95A1E]' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Tier 2: Dedicated Navigation Tabs Bar (Generous spacing, zero collision, fully legible on all devices) */}
      <div className="border-t border-[#2C1E16] bg-[#140D07]/95">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center space-x-1 sm:space-x-1.5 py-1.5 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id && activeTab === 'dashboard';

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectNav(item.id);
                    onSelectTab('dashboard');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[#EA580C] text-white shadow-xs'
                      : 'text-stone-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
