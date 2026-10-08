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
        icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
        color: 'text-rose-800 bg-rose-50 border-rose-200',
      };
    case 'recovery_started':
      return {
        label: 'Recovery Started',
        icon: <Play className="w-3.5 h-3.5 text-brand-600" />,
        color: 'text-brand-800 bg-brand-50 border-brand-200',
      };
    case 'dependency_check_passed':
      return {
        label: 'Gate Passed',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      };
    case 'dependency_check_failed':
      return {
        label: 'Gate Blocked',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        color: 'text-rose-800 bg-rose-50 border-rose-200',
      };
    case 'approval_requested':
      return {
        label: 'Approval Requested',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />,
        color: 'text-amber-800 bg-amber-50 border-amber-200',
      };
    case 'approval_approved':
      return {
        label: 'Approval Granted',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      };
    case 'approval_rejected':
      return {
        label: 'Approval Rejected',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        color: 'text-rose-800 bg-rose-50 border-rose-200',
      };
    case 'recovery_action_executed':
      return {
        label: 'Action Executed',
        icon: <Activity className="w-3.5 h-3.5 text-brand-600" />,
        color: 'text-brand-800 bg-brand-50 border-brand-200',
      };
    case 'health_check':
      return {
        label: 'Health Check',
        icon: <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />,
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      };
    case 'recovery_completed':
      return {
        label: 'Recovery Completed',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        color: 'text-emerald-800 bg-emerald-100 border-emerald-300 font-bold',
      };
    case 'recovery_failed':
      return {
        label: 'Recovery Failed',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        color: 'text-rose-800 bg-rose-100 border-rose-300 font-bold',
      };
    case 'recovery_aborted':
      return {
        label: 'Recovery Aborted',
        icon: <XCircle className="w-3.5 h-3.5 text-stone-500" />,
        color: 'text-stone-700 bg-stone-100 border-stone-200',
      };
    default:
      return {
        label: eventType,
        icon: <Activity className="w-3.5 h-3.5 text-stone-500" />,
        color: 'text-stone-700 bg-stone-100 border-stone-200',
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
    <div className="bg-white border border-[#E7E2D9] rounded-xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-brand-50 rounded-lg border border-brand-200">
            <History className="w-4 h-4 text-brand-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#1C130D]">
            Immutable Audit Trail
          </h3>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-stone-50 border border-[#E7E2D9] rounded-lg px-2.5 py-1 text-xs text-[#1C130D] font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
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
        <div className="py-12 text-center text-stone-500 flex flex-col items-center justify-center space-y-2">
          <History className="w-8 h-8 text-stone-400 stroke-[1.5]" />
          <p className="text-xs font-medium text-stone-600">No audit events recorded yet.</p>
          <p className="text-[11px] text-stone-400">
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
                className="bg-stone-50 border border-[#E7E2D9] rounded-lg p-3 text-xs space-y-1.5 transition hover:border-stone-300"
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
                      <span className="font-mono text-brand-700 font-bold text-[11px]">
                        [{event.service}]
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-stone-400 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Details summary */}
                <div className="flex items-center justify-between text-stone-600 text-[11px] pt-1">
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
                    className="text-stone-400 hover:text-stone-600 p-0.5"
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
                  <div className="mt-2 pt-2 border-t border-[#E7E2D9]">
                    <pre className="bg-white p-2.5 rounded text-[10px] font-mono text-stone-800 overflow-x-auto border border-[#E7E2D9]">
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

