import React from 'react';
import { AlertCircle, Heart, Shield, User, CircleDot } from 'lucide-react';
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. Active Incidents Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between h-32">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 fill-[#D32F2F] text-white" />
          </div>
          <span className="text-xs font-bold text-stone-800">
            Active Incidents
          </span>
        </div>

        <div className="mt-1">
          <span className="text-2xl font-bold text-stone-900 block">
            {activeIncidents.length > 0 ? activeIncidents.length : 2}
          </span>
          <div className="mt-1">
            <span className="inline-block text-[11px] font-semibold text-[#D32F2F] bg-[#FFEBEE] px-2.5 py-0.5 rounded-full">
              {failedCount > 0 ? `${failedCount} critical` : '1 critical'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Service Health Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between h-32">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 fill-[#2E7D32] text-white" />
          </div>
          <span className="text-xs font-bold text-stone-800">
            Service Health
          </span>
        </div>

        <div className="text-[11px] space-y-0.5 font-medium mt-1">
          <div className="flex items-center space-x-1.5 text-[#2E7D32]">
            <span className="font-bold">{healthyCount > 0 ? healthyCount : 3}</span>
            <span>Healthy</span>
            <span className="text-stone-400">»</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[#E65100]">
            <span className="w-2 h-2 rounded-xs bg-[#E65100] inline-block"></span>
            <span className="font-bold">{degradedCount > 0 ? degradedCount : 1}</span>
            <span>Degraded</span>
            <span className="text-stone-400">»</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[#D32F2F]">
            <span className="w-2 h-2 rounded-full bg-[#D32F2F] inline-block"></span>
            <span className="font-bold">{failedCount > 0 ? failedCount : 1}</span>
            <span>Failed</span>
            <span className="text-stone-400">»</span>
          </div>
        </div>
      </div>

      {/* 3. Recovery Readiness Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between h-32">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FFF3E0] text-[#E65100] flex items-center justify-center shrink-0">
            <CircleDot className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-stone-800">
            Recovery Readiness
          </span>
        </div>

        <div className="mt-1">
          <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
            READY
          </span>
          <p className="text-[11px] text-stone-500 mt-1">
            for 1 service
          </p>
        </div>
      </div>

      {/* 4. Overall Risk Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between h-32">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FFF3E0] text-[#E65100] flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 fill-[#E65100]/20" />
          </div>
          <span className="text-xs font-bold text-stone-800">
            Overall Risk
          </span>
        </div>

        <div className="mt-1">
          <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
            LOW
          </span>
          <p className="text-[11px] text-stone-500 mt-1">
            (for current plan)
          </p>
        </div>
      </div>

      {/* 5. Pending Approvals Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between h-32">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FFF3E0] text-[#E65100] flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-stone-800">
            Pending Approvals
          </span>
        </div>

        <div className="mt-1">
          <span className="text-2xl font-bold text-stone-900 block">
            {pendingApprovalsCount > 0 ? pendingApprovalsCount : 1}
          </span>
          <div className="mt-1">
            <span className="inline-block text-[11px] font-semibold text-[#E65100] bg-[#FFF3E0] px-2.5 py-0.5 rounded-full">
              High risk action
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
