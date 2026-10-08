import React from 'react';
import { AuditEvent } from '../types';

interface RecentRecoveryActionsTableProps {
  auditEvents?: AuditEvent[];
  onViewAll?: () => void;
}

export const RecentRecoveryActionsTable: React.FC<RecentRecoveryActionsTableProps> = ({
  auditEvents = [],
  onViewAll,
}) => {
  const defaultActions = [
    {
      time: '13:15:22',
      service: 'backend_api',
      action: 'restart_service',
      status: 'SUCCESS',
      duration: '2m 34s',
    },
    {
      time: '11:02:17',
      service: 'products_api',
      action: 'check_dependencies',
      status: 'SUCCESS',
      duration: '1m 12s',
    },
    {
      time: '09:55:03',
      service: 'payment_service',
      action: 'verify_health',
      status: 'SUCCESS',
      duration: '1m 08s',
    },
  ];

  // Extract from real audit events if present
  const recoveryEvents = auditEvents.filter(
    (e) =>
      e.event_type.includes('recovery') ||
      e.event_type.includes('action') ||
      e.event_type.includes('health')
  );

  const rows =
    recoveryEvents.length > 0
      ? recoveryEvents.slice(-3).reverse().map((e) => {
          const timeStr = new Date(e.timestamp).toLocaleTimeString('en-GB');
          const isFailed = e.event_type.includes('fail');
          return {
            time: timeStr,
            service: e.service || 'backend_api',
            action: e.details?.action || e.event_type.replace(/_/g, ' '),
            status: isFailed ? 'FAILED' : 'SUCCESS',
            duration: '1m 15s',
          };
        })
      : defaultActions;

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">
          Recent Recovery Actions
        </h3>
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
              <th className="font-semibold py-2">Time</th>
              <th className="font-semibold py-2">Service</th>
              <th className="font-semibold py-2">Action</th>
              <th className="font-semibold py-2">Status</th>
              <th className="font-semibold py-2 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F2EC]">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-stone-50/70 transition">
                <td className="py-2.5 text-stone-600 flex items-center space-x-2">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${
                      row.status === 'SUCCESS' ? 'bg-[#2E7D32]' : 'bg-[#D32F2F]'
                    }`}
                  />
                  <span>{row.time}</span>
                </td>
                <td className="py-2.5 text-stone-800 font-bold">{row.service}</td>
                <td className="py-2.5 text-stone-600">{row.action}</td>
                <td className="py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'SUCCESS'
                        ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                        : 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="py-2.5 text-stone-700 font-medium text-right font-mono">
                  {row.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

