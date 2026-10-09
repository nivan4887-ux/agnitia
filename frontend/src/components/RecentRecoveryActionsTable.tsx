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
    <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold text-stone-900 tracking-tight">
            Recent Recovery Actions
          </h3>
          <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
            {recoveryEvents.length}
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-medium text-stone-500 hover:text-stone-900 transition cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      {/* Table or Empty State */}
      {rows.length === 0 ? (
        <div className="py-7 text-center text-stone-500 flex flex-col items-center justify-center space-y-2 rounded-lg bg-stone-50/70 border border-stone-200/60">
          <Activity className="w-5 h-5 text-stone-400" />
          <p className="text-xs font-semibold text-stone-800">No recovery actions yet</p>
          <p className="text-[11px] text-stone-500">
            When recovery sequences are executed, allowlisted actions will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-stone-400 text-[11px] border-b border-stone-200/80 pb-2">
                <th className="font-semibold py-2">Time</th>
                <th className="font-semibold py-2">Service</th>
                <th className="font-semibold py-2">Action</th>
                <th className="font-semibold py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-stone-50/70 transition">
                  <td className="py-2.5 text-stone-600 flex items-center space-x-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block ${
                        row.status === 'SUCCESS'
                          ? 'bg-emerald-600'
                          : row.status === 'FAILED'
                          ? 'bg-rose-600'
                          : 'bg-amber-600 animate-pulse'
                      }`}
                    />
                    <span>{row.time}</span>
                  </td>
                  <td className="py-2.5 text-stone-800 font-semibold">{row.service}</td>
                  <td className="py-2.5 text-stone-600 capitalize">{row.action}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : row.status === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
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
