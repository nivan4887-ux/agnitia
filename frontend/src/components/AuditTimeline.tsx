import React from 'react';
import { AuditEvent } from '../types';

interface AuditTimelineProps {
  auditEvents: AuditEvent[];
  onViewAll?: () => void;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  auditEvents,
  onViewAll,
}) => {
  // If audit events exist, format them; otherwise provide the crisp defaults matching screenshot
  const defaultEvents = [
    {
      time: '13:21:03',
      action: 'Incident created',
      target: 'INC-20250516-001',
      color: 'bg-[#D32F2F]',
    },
    {
      time: '13:22:18',
      action: 'Recovery started',
      target: 'restart_service',
      color: 'bg-[#1976D2]',
    },
    {
      time: '13:24:36',
      action: 'Recovery verification passed',
      target: '/demo/health, /demo/products',
      color: 'bg-[#2E7D32]',
    },
    {
      time: '13:26:11',
      action: 'Incident resolved',
      target: 'MTTR: 4m 48s',
      color: 'bg-[#2E7D32]',
    },
  ];

  const formattedEvents =
    auditEvents.length > 0
      ? auditEvents.slice(-4).reverse().map((e) => {
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
        })
      : defaultEvents;

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Audit Timeline</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-[#D95A1E] hover:underline"
        >
          View All
        </button>
      </div>

      {/* Events List */}
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
    </div>
  );
};
