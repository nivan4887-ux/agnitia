import React from 'react';
import { AuditEvent } from '../types';

interface AuditTimelineProps {
  auditEvents: AuditEvent[];
  onViewAll?: () => void;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  auditEvents = [],
  onViewAll,
}) => {
  const formattedEvents = auditEvents.slice(-4).reverse().map((e) => {
    let dotColor = 'bg-[#2E7D32]';
    if (e.event_type.includes('incident') || e.event_type.includes('fail')) {
      dotColor = 'bg-[#D32F2F]';
    } else if (e.event_type.includes('start') || e.event_type.includes('action')) {
      dotColor = 'bg-[#1976D2]';
    } else if (e.event_type.includes('approval')) {
      dotColor = 'bg-[#E65100]';
    }

    const timeStr = new Date(e.timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return {
      time: timeStr,
      action: e.event_type.replace(/_/g, ' '),
      target:
        e.service ||
        e.details?.action ||
        e.incident_id?.slice(0, 10) ||
        'ok',
      color: dotColor,
    };
  });

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Audit Timeline</h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-[#D95A1E] hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      {/* Events List or Empty State */}
      {formattedEvents.length === 0 ? (
        <div className="py-6 text-center text-stone-500 flex flex-col items-center justify-center space-y-1.5 border border-dashed border-[#E7E2D9] rounded-xl bg-stone-50/50">
          <p className="text-xs font-semibold text-stone-800">No audit events recorded</p>
          <p className="text-[11px] text-stone-500">
            Lifecycle transitions, approvals, and recoveries will be recorded here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 font-mono text-[11px]">
          {formattedEvents.map((evt, idx) => (
            <div key={idx} className="flex items-center space-x-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${evt.color}`}
              />
              <span className="text-stone-500 shrink-0">{evt.time}</span>
              <span className="text-stone-800 font-medium capitalize truncate">
                {evt.action}
              </span>
              <span className="text-stone-500 truncate ml-auto">
                {evt.target}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
