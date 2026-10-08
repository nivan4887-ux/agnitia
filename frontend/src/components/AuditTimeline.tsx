import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Play,
  Activity,
  HeartPulse,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditTimelineProps {
  auditEvents: AuditEvent[];
}

const getEventBadge = (eventType: string) => {
  switch (eventType) {
    case 'incident_created':
      return {
        label: 'Incident Created',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
        color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
      };
    case 'recovery_started':
      return {
        label: 'Recovery Started',
        icon: <Play className="w-3.5 h-3.5 text-cyan-400" />,
        color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60',
      };
    case 'dependency_check_passed':
      return {
        label: 'Gate Passed',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
      };
    case 'dependency_check_failed':
      return {
        label: 'Gate Blocked',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        color: 'text-rose-400 bg-rose-950/80 border-rose-800',
      };
    case 'approval_requested':
      return {
        label: 'Approval Requested',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />,
        color: 'text-amber-400 bg-amber-950/80 border-amber-800',
      };
    case 'approval_approved':
      return {
        label: 'Approval Granted',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
      };
    case 'approval_rejected':
      return {
        label: 'Approval Rejected',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
      };
    case 'recovery_action_executed':
      return {
        label: 'Action Executed',
        icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
        color: 'text-cyan-300 bg-cyan-950/40 border-cyan-800/40',
      };
    case 'health_check':
      return {
        label: 'Health Check',
        icon: <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />,
        color: 'text-emerald-300 bg-emerald-950/40 border-emerald-800/40',
      };
    case 'recovery_completed':
      return {
        label: 'Recovery Completed',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        color: 'text-emerald-400 bg-emerald-950 border-emerald-700',
      };
    case 'recovery_failed':
      return {
        label: 'Recovery Failed',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        color: 'text-rose-400 bg-rose-950 border-rose-700',
      };
    case 'recovery_aborted':
      return {
        label: 'Recovery Aborted',
        icon: <XCircle className="w-3.5 h-3.5 text-slate-400" />,
        color: 'text-slate-400 bg-slate-900 border-slate-700',
      };
    default:
      return {
        label: eventType,
        icon: <Activity className="w-3.5 h-3.5 text-slate-400" />,
        color: 'text-slate-400 bg-slate-900 border-slate-800',
      };
  }
};

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ auditEvents }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Newest events on top
  const sorted = [...auditEvents].reverse();

  const filtered = sorted.filter((e) => {
    if (filterType === 'all') return true;
    return e.event_type.toLowerCase().includes(filterType.toLowerCase());
  });

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">
            Immutable Audit Trail
          </h3>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="all">All Events ({auditEvents.length})</option>
          <option value="incident">Incidents</option>
          <option value="dependency">Gate Checks</option>
          <option value="approval">Approvals</option>
          <option value="health_check">Health Probes</option>
          <option value="recovery">Recovery Runs</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <History className="w-8 h-8 text-slate-600 stroke-[1.5]" />
          <p className="text-xs">No audit events recorded yet.</p>
          <p className="text-[11px] text-slate-600">
            All state transitions, approval decisions, and probe verifications will be logged here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
          {filtered.map((event) => {
            const badge = getEventBadge(event.event_type);
            const isExpanded = expandedId === event.id;

            return (
              <div
                key={event.id}
                className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1.5 transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    {event.service && (
                      <span className="font-mono text-cyan-300 font-semibold text-[11px]">
                        [{event.service}]
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Details summary */}
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1">
                  <div className="truncate max-w-[80%] font-mono">
                    {event.details?.reason ||
                      event.details?.message ||
                      (event.details?.affected_services
                        ? `Affected: ${event.details.affected_services.join(', ')}`
                        : event.details?.action
                        ? `Action: ${event.details.action}`
                        : `Incident: ${event.incident_id?.slice(0, 8) || 'N/A'}`)}
                  </div>

                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : event.id)
                    }
                    className="text-slate-500 hover:text-slate-300 p-0.5"
                    title="Toggle payload"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-800">
                    <pre className="bg-slate-950 p-2 rounded text-[10px] font-mono text-slate-300 overflow-x-auto border border-slate-850">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

