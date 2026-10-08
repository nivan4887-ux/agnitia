import React from 'react';
import { Incident } from '../types';

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
  interface IncidentRow {
    id: string;
    service: string;
    status: string;
    risk: string;
    detected: string;
    duration: string;
    raw?: Incident;
  }

  const defaultIncidents: IncidentRow[] = [
    {
      id: 'INC-20250516-001',
      service: 'backend_api',
      status: 'OPEN',
      risk: 'LOW',
      detected: '13:21:03',
      duration: '10m 42s',
    },
    {
      id: 'INC-20250516-002',
      service: 'products_api',
      status: 'DEGRADED',
      risk: 'MEDIUM',
      detected: '11:08:17',
      duration: '2h 15m',
    },
    {
      id: 'INC-20250516-004',
      service: 'payment_service',
      status: 'RESOLVED',
      risk: 'LOW',
      detected: '09:42:36',
      duration: '4h 32m',
    },
  ];

  const rows: IncidentRow[] =
    incidents.length > 0
      ? incidents.slice(0, 4).map((inc) => {
          const status = inc.status.toUpperCase();
          const risk = inc.failed_service === 'database' ? 'HIGH' : 'LOW';
          const timeStr = new Date(inc.created_at).toLocaleTimeString('en-GB');
          const dur = inc.total_recovery_duration_seconds !== null && inc.total_recovery_duration_seconds !== undefined
            ? `${inc.total_recovery_duration_seconds.toFixed(0)}s`
            : '10m 42s';

          return {
            id: `INC-${inc.id.slice(0, 8).toUpperCase()}`,
            service: inc.failed_service,
            status,
            risk,
            detected: timeStr,
            duration: dur,
            raw: inc,
          };
        })
      : defaultIncidents;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
            OPEN
          </span>
        );
      case 'DEGRADED':
      case 'AWAITING_APPROVAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
            DEGRADED
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

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Recent Incidents</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-[#D95A1E] hover:underline"
        >
          View All
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="text-stone-400 text-[11px] border-b border-[#EFEAE2] pb-2">
              <th className="font-semibold py-2">ID</th>
              <th className="font-semibold py-2">Service</th>
              <th className="font-semibold py-2">Status</th>
              <th className="font-semibold py-2">Risk</th>
              <th className="font-semibold py-2">Detected</th>
              <th className="font-semibold py-2">Duration</th>
              <th className="font-semibold py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F2EC]">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-stone-50/70 transition">
                <td className="py-2.5 font-bold text-stone-900 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 inline-block" />
                  <span>{row.id}</span>
                </td>
                <td className="py-2.5 text-stone-700 font-semibold">{row.service}</td>
                <td className="py-2.5">{getStatusBadge(row.status)}</td>
                <td className="py-2.5">{getRiskBadge(row.risk)}</td>
                <td className="py-2.5 text-stone-500">{row.detected}</td>
                <td className="py-2.5 text-stone-700 font-medium">{row.duration}</td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => row.raw && onSelectIncident?.(row.raw)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 rounded-lg shadow-2xs transition"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
