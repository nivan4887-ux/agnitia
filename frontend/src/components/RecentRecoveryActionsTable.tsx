import React from 'react';
import { AuditEvent } from '../types';
import { Activity } from 'lucide-react';

interface RecentRecoveryActionsTableProps {
  auditEvents?: AuditEvent[];
  onViewAll?: () => void;
}

export const RecentRecoveryActionsTable: React.FC<RecentRecoveryActionsTableProps> = ({
  auditEvents = [],
  onViewAll,
}) => {
  // Extract real recovery-related audit events
  const recoveryEvents = auditEvents.filter(
    (e) =>
      e.event_type.includes('recovery') ||
      e.event_type.includes('action') ||
      e.event_type.includes('health') ||
      e.event_type.includes('probe')
  );

  const rows = recoveryEvents.slice(-4).reverse().map((e) => {
    const timeStr = new Date(e.timestamp).toLocaleTimeString('en-GB');
    const isFailed = e.event_type.includes('fail');
    const isPending = e.event_type.includes('start') || e.event_type.includes('request');

    let status = 'SUCCESS';
    if (isFailed) status = 'FAILED';
    else if (isPending) status = 'IN PROGRESS';

    return {
      id: e.id,
      time: timeStr,
      service: e.service || 'backend_api',
      action: e.details?.action || e.event_type.replace(/_/g, ' '),
      status,
      details: e.details,
    };
  });

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-bold text-stone-900">
            Recent Recovery Actions
          </h3>
          <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
            {recoveryEvents.length}
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
      {rows.length === 0 ? (
        <div className="py-8 text-center text-stone-500 flex flex-col items-center justify-center space-y-2 border border-dashed border-[#E7E2D9] rounded-xl bg-stone-50/50">
          <Activity className="w-7 h-7 text-stone-400" />
          <p className="text-xs font-semibold text-stone-800">No recovery actions yet</p>
          <p className="text-[11px] text-stone-500">
            When recovery sequences are executed, allowlisted actions will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-stone-400 text-[11px] border-b border-[#EFEAE2] pb-2">
                <th className="font-semibold py-2">Time</th>
                <th className="font-semibold py-2">Service</th>
                <th className="font-semibold py-2">Action</th>
                <th className="font-semibold py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC]">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-stone-50/70 transition">
                  <td className="py-2.5 text-stone-600 flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        row.status === 'SUCCESS'
                          ? 'bg-[#2E7D32]'
                          : row.status === 'FAILED'
                          ? 'bg-[#D32F2F]'
                          : 'bg-[#D95A1E] animate-pulse'
                      }`}
                    />
                    <span>{row.time}</span>
                  </td>
                  <td className="py-2.5 text-stone-800 font-bold">{row.service}</td>
                  <td className="py-2.5 text-stone-600 capitalize">{row.action}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'SUCCESS'
                          ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                          : row.status === 'FAILED'
                          ? 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
                          : 'bg-[#FFF3E0] text-[#D95A1E] border border-[#FFE0B2]'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
