import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Server,
  Layers,
} from 'lucide-react';
import { Incident, ServiceHealth } from '../types';

interface OverviewCardsProps {
  services: Record<string, ServiceHealth>;
  incidents: Incident[];
  pendingApprovalsCount: number;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  services,
  incidents,
  pendingApprovalsCount,
}) => {
  const serviceList = Object.entries(services);
  const totalServices = serviceList.length;
  const healthyCount = serviceList.filter(([_, s]) => s === 'healthy').length;
  const degradedCount = serviceList.filter(([_, s]) => s === 'degraded').length;
  const failedCount = serviceList.filter(([_, s]) => s === 'failed' || s === 'recovering').length;

  const activeIncidents = incidents.filter(
    (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
  );

  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');
  const latestResolved = resolvedIncidents[resolvedIncidents.length - 1];

  const overallStatus =
    failedCount > 0
      ? 'CRITICAL'
      : degradedCount > 0
      ? 'DEGRADED'
      : totalServices > 0
      ? 'HEALTHY'
      : 'UNKNOWN';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Services Health Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            System Topology
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              overallStatus === 'HEALTHY'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                : overallStatus === 'DEGRADED'
                ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
            }`}
          >
            <Server className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-['JetBrains_Mono'] text-white">
              {healthyCount}/{totalServices}
            </span>
            <span className="text-xs text-slate-400">Services Up</span>
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded uppercase font-['JetBrains_Mono'] ${
              overallStatus === 'HEALTHY'
                ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
                : overallStatus === 'DEGRADED'
                ? 'text-amber-400 bg-amber-950 border border-amber-800'
                : 'text-rose-400 bg-rose-950 border border-rose-800 animate-pulse'
            }`}
          >
            {overallStatus}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center space-x-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>{healthyCount} Ok</span>
          </div>
          <div className="flex items-center space-x-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{degradedCount} Degraded</span>
          </div>
          <div className="flex items-center space-x-1 text-rose-400">
            <XCircle className="w-3 h-3" />
            <span>{failedCount} Down</span>
          </div>
        </div>
      </div>

      {/* 2. Active Incidents Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Incidents
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              activeIncidents.length > 0
                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-['JetBrains_Mono'] text-white">
              {activeIncidents.length}
            </span>
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <span className="text-xs text-slate-400">
            Total: {incidents.length}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
          <span>
            {activeIncidents.filter((i) => i.status === 'awaiting_approval').length} Awaiting Approval
          </span>
          <span>{resolvedIncidents.length} Resolved</span>
        </div>
      </div>

      {/* 3. Pending Approvals Card */}
      <div
        className={`border rounded-xl p-4 shadow-sm relative overflow-hidden transition ${
          pendingApprovalsCount > 0
            ? 'bg-amber-950/20 border-amber-600/60'
            : 'bg-[#0f172a] border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Human Approval Gate
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              pendingApprovalsCount > 0
                ? 'bg-amber-500 text-black animate-bounce'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl font-bold font-['JetBrains_Mono'] ${
                pendingApprovalsCount > 0 ? 'text-amber-400' : 'text-white'
              }`}
            >
              {pendingApprovalsCount}
            </span>
            <span className="text-xs text-slate-400">Pending Actions</span>
          </div>
          {pendingApprovalsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ACTION REQUIRED
            </span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
          <span>High-Risk Protection</span>
          <span className="text-emerald-400">Enforced</span>
        </div>
      </div>

      {/* 4. Recovery Duration / Performance */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recovery Duration
          </span>
          <div className="p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold font-['JetBrains_Mono'] text-white">
              {latestResolved?.total_recovery_duration_seconds !== null &&
              latestResolved?.total_recovery_duration_seconds !== undefined
                ? `${latestResolved.total_recovery_duration_seconds.toFixed(2)}s`
                : '—'}
            </span>
            <span className="text-xs text-slate-400">Last MTTR</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-cyan-400">
            <Layers className="w-3.5 h-3.5" />
            <span>Dependency-Aware</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
          <span>Sequential Order</span>
          <span className="text-slate-300 font-mono">Topological</span>
        </div>
      </div>
    </div>
  );
};

