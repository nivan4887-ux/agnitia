import React from 'react';
import { Incident } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface RecentIncidentsTableProps {
  incidents: Incident[];
  onSelectIncident?: (incident: Incident) => void;
  onViewAll?: () => void;
}

export const RecentIncidentsTable: React.FC<RecentIncidentsTableProps> = ({
  incidents,
  onSelectIncident,
  onViewAll,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
            OPEN
          </span>
        );
      case 'RECOVERING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF3E0] text-[#D95A1E] border border-[#FFE0B2] animate-pulse">
            RECOVERING
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF8E1] text-[#F57F17] border border-[#FFECB3]">
            AWAITING APPROVAL
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
            FAILED
          </span>
        );
      case 'RESOLVED':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
            RESOLVED
          </span>
        );
    }
  };

  const getRiskBadge = (service: string) => {
    const isHigh = service === 'database';
    const isMed = service === 'products_api';
    if (isHigh) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
          HIGH
        </span>
      );
    }
    if (isMed) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
          MEDIUM
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
        LOW
      </span>
    );
  };

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-bold text-stone-900">Recent Incidents</h3>
          <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
            {incidents.length}
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-[#D95A1E] hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      {/* Table or Empty State */}
      {incidents.length === 0 ? (
        <div className="py-8 text-center text-stone-500 flex flex-col items-center justify-center space-y-2 border border-dashed border-[#E7E2D9] rounded-xl bg-stone-50/50">
          <CheckCircle2 className="w-7 h-7 text-[#2E7D32]" />
          <p className="text-xs font-semibold text-stone-800">No active incidents</p>
          <p className="text-[11px] text-stone-500">
            All system services are operating within normal SLO parameters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-stone-400 text-[11px] border-b border-[#EFEAE2] pb-2">
                <th className="font-semibold py-2">ID</th>
                <th className="font-semibold py-2">Root Service</th>
                <th className="font-semibold py-2">Status</th>
                <th className="font-semibold py-2">Risk</th>
                <th className="font-semibold py-2">Detected</th>
                <th className="font-semibold py-2">Duration</th>
                <th className="font-semibold py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC]">
              {incidents.slice(0, 5).map((inc) => {
                const status = inc.status.toUpperCase();
                const timeStr = new Date(inc.created_at).toLocaleTimeString('en-GB');
                const dur =
                  inc.total_recovery_duration_seconds !== null &&
                  inc.total_recovery_duration_seconds !== undefined
                    ? `${inc.total_recovery_duration_seconds.toFixed(1)}s`
                    : inc.status === 'resolved'
                    ? 'Resolved'
                    : 'Active';

                return (
                  <tr key={inc.id} className="hover:bg-stone-50/70 transition">
                    <td className="py-2.5 font-bold text-stone-900 flex items-center space-x-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full inline-block ${
                          inc.status === 'resolved' ? 'bg-[#2E7D32]' : 'bg-[#D32F2F]'
                        }`}
                      />
                      <span>INC-{inc.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td className="py-2.5 text-stone-700 font-semibold">{inc.failed_service}</td>
                    <td className="py-2.5">{getStatusBadge(status)}</td>
                    <td className="py-2.5">{getRiskBadge(inc.failed_service)}</td>
                    <td className="py-2.5 text-stone-500">{timeStr}</td>
                    <td className="py-2.5 text-stone-700 font-medium">{dur}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => onSelectIncident?.(inc)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
