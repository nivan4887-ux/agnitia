import React from 'react';
import {
  Home,
  AlertOctagon,
  Flame,
  Network,
  ClipboardList,
  Settings,
  Shield,
  Tent,
} from 'lucide-react';

interface SidebarProps {
  activeNav: string;
  onSelectNav: (nav: string) => void;
  activeIncidentsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onSelectNav,
  activeIncidentsCount,
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
    { id: 'graph', label: 'Dependency Graph', icon: Network },
    { id: 'audit', label: 'Audit Log', icon: ClipboardList },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#1C130D] text-stone-300 flex flex-col justify-between shrink-0 min-h-screen p-4 border-r border-[#2C1E16] select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-start space-x-3 px-2 pt-2">
          <div className="w-9 h-9 rounded-xl bg-[#D95A1E] flex items-center justify-center text-white shadow-md shrink-0">
            <Shield className="w-5 h-5 fill-white/20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-white tracking-tight">
                RecoverOps
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white/10 text-stone-300 rounded">
                v0.2.0
              </span>
            </div>
            <p className="text-[11px] text-stone-400 truncate leading-tight mt-0.5">
              Dependency-Aware Incident Recovery
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#D95A1E] text-white shadow-sm'
                    : 'text-stone-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="w-4 h-4 rounded-full bg-[#D32F2F] text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Stay Calm Callout Box */}
      <div className="mt-8 pt-4 border-t border-white/10 px-2 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-[#D95A1E]/20 text-[#D95A1E] flex items-center justify-center shrink-0">
          <Tent className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold text-white">Stay calm.</p>
          <p className="text-xs font-bold text-white">Recover faster.</p>
          <span className="text-[10px] text-stone-400 font-mono">RecoverOps</span>
        </div>
      </div>
    </aside>
  );
};

