import React from 'react';
import { AlertCircle, Activity, ShieldCheck, UserCheck, Flame } from 'lucide-react';
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
  const totalServices = serviceList.length || 5;
  const healthyCount = serviceList.filter(([_, s]) => s === 'healthy').length;
  const degradedCount = serviceList.filter(([_, s]) => s === 'degraded').length;
  const failedCount = serviceList.filter(
    ([_, s]) => s === 'failed' || s === 'recovering'
  ).length;

  const activeIncidents = incidents.filter(
    (i) =>
      i.status === 'open' ||
      i.status === 'recovering' ||
      i.status === 'awaiting_approval'
  );

  const hasIncidents = activeIncidents.length > 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-5">
      {/* 1. Active Incidents Card */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-3.5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Active Incidents
          </span>
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              hasIncidents ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1.5">
          <span className={`text-2xl font-black tracking-tight ${hasIncidents ? 'text-rose-600' : 'text-stone-900'}`}>
            {activeIncidents.length}
          </span>
        </div>

        <div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              hasIncidents
                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                hasIncidents ? 'bg-rose-600 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            {hasIncidents ? `${activeIncidents.length} Unresolved` : 'All Systems Normal'}
          </span>
        </div>
      </div>

      {/* 2. Service Health Card */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-3.5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Service Health
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1.5 flex items-baseline space-x-1.5">
          <span className="text-2xl font-black text-stone-900 tracking-tight">
            {healthyCount}
          </span>
          <span className="text-xs text-stone-400 font-semibold">
            / {totalServices} Healthy
          </span>
        </div>

        <div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              failedCount > 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                : degradedCount > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                failedCount > 0
                  ? 'bg-rose-600'
                  : degradedCount > 0
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            {failedCount > 0
              ? `${failedCount} Failed`
              : degradedCount > 0
              ? `${degradedCount} Degraded`
              : '100% Operational'}
          </span>
        </div>
      </div>

      {/* 3. Recovery Readiness Card */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-3.5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Recovery Engine
          </span>
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              hasIncidents ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <Flame className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1.5">
          <span className="text-2xl font-black text-stone-900 tracking-tight">
            {hasIncidents ? 'ARMED' : 'STANDBY'}
          </span>
        </div>

        <div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              hasIncidents
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-stone-50 text-stone-600 border border-stone-200/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                hasIncidents ? 'bg-amber-500 animate-pulse' : 'bg-stone-400'
              }`}
            />
            {hasIncidents ? 'Plan Ready' : 'Auto-Recovery Armed'}
          </span>
        </div>
      </div>

      {/* 4. Overall Risk Card */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-3.5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Risk Posture
          </span>
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              failedCount > 0
                ? 'bg-rose-50 text-rose-600'
                : degradedCount > 0
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1.5">
          <span
            className={`text-2xl font-black tracking-tight ${
              failedCount > 0
                ? 'text-rose-600'
                : degradedCount > 0
                ? 'text-amber-600'
                : 'text-stone-900'
            }`}
          >
            {failedCount > 0 ? 'CRITICAL' : degradedCount > 0 ? 'ELEVATED' : 'NOMINAL'}
          </span>
        </div>

        <div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              failedCount > 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                : degradedCount > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                failedCount > 0 ? 'bg-rose-600' : degradedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            {failedCount > 0 ? 'Outage Active' : degradedCount > 0 ? 'Degraded Traffic' : 'Zero Active Threats'}
          </span>
        </div>
      </div>

      {/* 5. Pending Approvals Card */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-3.5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-all col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Pending Gates
          </span>
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              pendingApprovalsCount > 0
                ? 'bg-amber-50 text-amber-600'
                : 'bg-stone-50 text-stone-600'
            }`}
          >
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1.5">
          <span className="text-2xl font-black text-stone-900 tracking-tight">
            {pendingApprovalsCount}
          </span>
        </div>

        <div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              pendingApprovalsCount > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-stone-50 text-stone-600 border border-stone-200/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                pendingApprovalsCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-stone-400'
              }`}
            />
            {pendingApprovalsCount > 0
              ? `${pendingApprovalsCount} High Risk Actions`
              : '0 Pending Gates'}
          </span>
        </div>
      </div>
    </div>
  );
};
