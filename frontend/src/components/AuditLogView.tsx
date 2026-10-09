import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  FileJson,
} from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditLogViewProps {
  auditEvents: AuditEvent[];
  onRefresh: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  auditEvents,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('all');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Extract unique event types for filter
  const eventTypes = Array.from(new Set(auditEvents.map((e) => e.event_type)));

  const filteredEvents = auditEvents.filter((event) => {
    const matchesFilter =
      filterEventType === 'all' || event.event_type === filterEventType;

    const matchesSearch =
      event.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.service && event.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (event.incident_id && event.incident_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      JSON.stringify(event.details).toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const getEventBadge = (eventType: string) => {
    if (eventType.includes('fail') || eventType.includes('reject')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
          {eventType}
        </span>
      );
    }
    if (eventType.includes('complete') || eventType.includes('approve') || eventType.includes('healthy')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
          {eventType}
        </span>
      );
    }
    if (eventType.includes('start') || eventType.includes('request')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#FFF3E0] text-[#D95A1E] border border-[#FFE0B2]">
          {eventType}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-stone-100 text-stone-700 border border-stone-300">
        {eventType}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#D95A1E] text-white flex items-center justify-center shadow-md">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Audit Log & Compliance Timeline
            </h2>
            <p className="text-xs text-stone-500">
              Immutable telemetry log recording every incident, assessment, approval decision, and recovery adapter action.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
            Total Records: {auditEvents.length}
          </span>
          <button
            onClick={onRefresh}
            title="Refresh audit log"
            className="p-2 rounded-lg border border-stone-200/80 bg-stone-50 hover:bg-stone-100 text-stone-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200/90 rounded-xl p-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-stone-700">Filter Event Type:</label>
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="bg-stone-50 border border-stone-200/80 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 font-mono focus:outline-none"
          >
            <option value="all">All Events ({auditEvents.length})</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t} ({auditEvents.filter((e) => e.event_type === t).length})
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search details, service, or incident ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200/80 rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#D95A1E] w-64 sm:w-80"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white border border-stone-200/90 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center border border-stone-200">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">No Audit Events Found</h3>
          <p className="text-xs text-stone-500 max-w-sm">
            {searchQuery
              ? 'No audit log records match your current search query.'
              : 'Audit events will appear here as incidents, recovery workflows, and probe events execute.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-stone-400 text-[11px] border-b border-stone-200/80 bg-stone-50/70">
                  <th className="font-semibold py-3 px-4">Timestamp</th>
                  <th className="font-semibold py-3 px-4">Event Type</th>
                  <th className="font-semibold py-3 px-4">Target Service</th>
                  <th className="font-semibold py-3 px-4">Incident Ref</th>
                  <th className="font-semibold py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredEvents.map((event) => {
                  const isExpanded = expandedEventId === event.id;
                  const timeStr = new Date(event.timestamp).toLocaleString();

                  return (
                    <React.Fragment key={event.id}>
                      <tr className="hover:bg-stone-50/70 transition">
                        <td className="py-3 px-4 text-stone-600 flex items-center space-x-1.5 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{timeStr}</span>
                        </td>
                        <td className="py-3 px-4">{getEventBadge(event.event_type)}</td>
                        <td className="py-3 px-4 font-bold text-stone-900">
                          {event.service || '—'}
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          {event.incident_id ? (
                            <span className="font-mono text-[11px] bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                              INC-{event.incident_id.slice(0, 8).toUpperCase()}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() =>
                              setExpandedEventId(isExpanded ? null : event.id)
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 rounded-lg shadow-2xs transition inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <FileJson className="w-3 h-3 text-stone-500" />
                            <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-stone-50/80">
                          <td colSpan={5} className="p-4">
                            <div className="bg-stone-900 text-stone-100 rounded-xl p-3.5 text-xs font-mono overflow-x-auto shadow-inner">
                              <pre className="text-[11px] leading-relaxed">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
