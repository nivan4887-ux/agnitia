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
      <div className="bg-white border border-[#E7E2D9] rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            System Topology
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              overallStatus === 'HEALTHY'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : overallStatus === 'DEGRADED'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            <Server className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-['JetBrains_Mono'] text-[#1C130D]">
              {healthyCount}/{totalServices}
            </span>
            <span className="text-xs text-stone-500">Services Up</span>
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded uppercase font-['JetBrains_Mono'] ${
              overallStatus === 'HEALTHY'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : overallStatus === 'DEGRADED'
                ? 'text-amber-800 bg-amber-50 border border-amber-200'
                : 'text-rose-700 bg-rose-50 border border-rose-200 animate-pulse'
            }`}
          >
            {overallStatus}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 pt-2 border-t border-[#F0EBE1] text-xs">
          <div className="flex items-center space-x-1 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>{healthyCount} Ok</span>
          </div>
          <div className="flex items-center space-x-1 text-amber-700 font-medium">
            <AlertTriangle className="w-3 h-3" />
            <span>{degradedCount} Degr.</span>
          </div>
          <div className="flex items-center space-x-1 text-rose-700 font-medium">
            <XCircle className="w-3 h-3" />
            <span>{failedCount} Down</span>
          </div>
        </div>
      </div>

      {/* 2. Active Incidents Card */}
      <div className="bg-white border border-[#E7E2D9] rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Active Incidents
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              activeIncidents.length > 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-warm-100 text-stone-600 border border-[#E7E2D9]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-['JetBrains_Mono'] text-[#1C130D]">
              {activeIncidents.length}
            </span>
            <span className="text-xs text-stone-500">Active</span>
          </div>
          <span className="text-xs text-stone-500 font-mono">
            Total: {incidents.length}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#F0EBE1] text-xs text-stone-600">
          <span>
            {activeIncidents.filter((i) => i.status === 'awaiting_approval').length} Awaiting Approval
          </span>
          <span className="font-medium text-emerald-700">{resolvedIncidents.length} Resolved</span>
        </div>
      </div>

      {/* 3. Pending Approvals Card */}
      <div
        className={`border rounded-xl p-4 shadow-sm relative overflow-hidden transition ${
          pendingApprovalsCount > 0
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-white border-[#E7E2D9]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Human Approval Gate
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              pendingApprovalsCount > 0
                ? 'bg-amber-500 text-white animate-bounce'
                : 'bg-warm-100 text-stone-600 border border-[#E7E2D9]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl font-bold font-['JetBrains_Mono'] ${
                pendingApprovalsCount > 0 ? 'text-amber-800' : 'text-[#1C130D]'
              }`}
            >
              {pendingApprovalsCount}
            </span>
            <span className="text-xs text-stone-500">Pending Actions</span>
          </div>
          {pendingApprovalsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
              ACTION REQ.
            </span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-[#F0EBE1] text-xs text-stone-600 flex items-center justify-between">
          <span>High-Risk Protection</span>
          <span className="text-emerald-700 font-semibold">Enforced</span>
        </div>
      </div>

      {/* 4. Recovery Duration / Performance */}
      <div className="bg-white border border-[#E7E2D9] rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Recovery Duration
          </span>
          <div className="p-1.5 rounded-lg bg-warm-100 text-stone-600 border border-[#E7E2D9]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold font-['JetBrains_Mono'] text-[#1C130D]">
              {latestResolved?.total_recovery_duration_seconds !== null &&
              latestResolved?.total_recovery_duration_seconds !== undefined
                ? `${latestResolved.total_recovery_duration_seconds.toFixed(2)}s`
                : '—'}
            </span>
            <span className="text-xs text-stone-500">Last MTTR</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-brand-700 font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>Dependency-Aware</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#F0EBE1] text-xs text-stone-500 flex items-center justify-between">
          <span>Sequential Order</span>
          <span className="text-stone-700 font-mono font-medium">Topological</span>
        </div>
      </div>
    </div>
  );
};

