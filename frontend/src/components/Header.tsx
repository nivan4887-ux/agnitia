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
  FileCode,
  ShieldCheck,
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
}) => {

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: AlertOctagon,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
    },
    { id: 'engine', label: 'Recovery Engine', icon: Flame },
    { id: 'integrity', label: 'Data Integrity', icon: ShieldCheck },
    { id: 'code_review', label: 'Code Review', icon: FileCode },
    { id: 'graph', label: 'Dependency Graph', icon: Network },
    { id: 'audit', label: 'Audit Log', icon: ClipboardList },
  ];

  return (
    <header className="bg-[#1C130D] text-stone-300 border-b border-[#2C1E16] sticky top-0 z-50 shadow-md">
      {/* Main Top Navigation Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Brand Identity & Primary Nav Links */}
          <div className="flex items-center space-x-6">
            {/* Brand Logo & Title */}
            <div
              className="flex items-center space-x-3 cursor-pointer select-none shrink-0"
              onClick={() => {
                onSelectNav('overview');
                onSelectTab('dashboard');
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md overflow-hidden">
                <img src="/logo.png" alt="BRIDGE Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-black text-white tracking-wider font-mono">
                  BRIDGE
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white/10 text-stone-300 rounded">
                  v1.0.0
                </span>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block h-6 w-px bg-stone-700/60" />

            {/* Navigation Tabs */}
            <nav className="hidden lg:flex items-center space-x-1 shrink-0">
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
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#D95A1E] text-white shadow-sm'
                        : 'text-stone-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#D32F2F] text-white text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Mode Switchers & Telemetry */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Emergency SOS Trigger Button */}
            {onOpenSOS && (
              <button
                onClick={onOpenSOS}
                title="Trigger Emergency Priority-1 SOS Incident"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition border border-rose-500/50 cursor-pointer active:scale-95 shrink-0"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>SOS Alert</span>
              </button>
            )}

            {/* Mode Switcher Pill Group */}
            <div className="bg-[#2A1D15] p-1 rounded-xl border border-stone-800 flex items-center space-x-1">
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#D95A1E] text-white shadow-sm'
                    : 'text-stone-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>SRE Console</span>
              </button>

              <button
                onClick={() => onSelectTab('demo_store')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                  activeTab === 'demo_store'
                    ? 'bg-[#D95A1E] text-white shadow-sm'
                    : 'text-stone-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Live Store</span>
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="hidden sm:block h-5 w-px bg-stone-700/60" />

            {/* Live System Status Indicators */}
            <div className="flex items-center space-x-2 text-xs font-medium text-stone-300">
              {/* API Connected Status */}
              <div
                className="flex items-center space-x-1.5 bg-[#2A1D15] px-2.5 py-1.5 rounded-lg border border-stone-800"
                title={backendOnline ? 'API Connected to backend' : 'Backend offline'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendOnline ? 'bg-[#4CAF50] animate-pulse' : 'bg-[#D32F2F]'
                  }`}
                />
                <span className="font-semibold text-stone-200 hidden sm:inline">
                  {backendOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Refresh button */}
              <button
                onClick={onRefresh}
                title="Refresh telemetry"
                className="p-1.5 rounded-lg bg-[#2A1D15] hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 transition cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-[#D95A1E]' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Nav Row (Visible when screen is smaller than lg) */}
        <div className="lg:hidden flex items-center space-x-1 overflow-x-auto py-2 border-t border-stone-800/80 scrollbar-none">
          {onOpenSOS && (
            <button
              onClick={onOpenSOS}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-600 text-white shrink-0 active:scale-95 transition"
            >
              <AlertOctagon className="w-3 h-3 text-white animate-pulse" />
              <span>SOS</span>
            </button>
          )}
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
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#D95A1E] text-white'
                    : 'text-stone-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#D32F2F] text-white text-[9px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
