import React, { useState } from 'react';
import {
  AlertCircle,
  Play,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldAlert,
  XCircle,
  Layers,
  Activity,
} from 'lucide-react';
import { Incident } from '../types';
import { api } from '../services/api';

interface IncidentPanelProps {
  incidents: Incident[];
  onRecoveryStarted: () => void;
  onError: (msg: string) => void;
}

const getStatusBadge = (status: Incident['status']) => {
  switch (status) {
    case 'open':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-rose-50 text-rose-800 border border-rose-300 flex items-center space-x-1 font-mono">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>Open</span>
        </span>
      );
    case 'recovering':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-brand-50 text-brand-800 border border-brand-300 flex items-center space-x-1 animate-pulse font-mono">
          <Loader2 className="w-3 h-3 animate-spin text-brand-600" />
          <span>Recovering</span>
        </span>
      );
    case 'awaiting_approval':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1 animate-pulse font-mono">
          <ShieldAlert className="w-3 h-3 text-amber-600" />
          <span>Awaiting Approval</span>
        </span>
      );
    case 'resolved':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center space-x-1 font-mono">
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          <span>Resolved</span>
        </span>
      );
    case 'failed':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-rose-50 text-rose-800 border border-rose-300 flex items-center space-x-1 font-mono">
          <XCircle className="w-3 h-3 text-rose-600" />
          <span>Failed</span>
        </span>
      );
    case 'aborted':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-stone-100 text-stone-700 border border-stone-300 flex items-center space-x-1 font-mono">
          <XCircle className="w-3 h-3 text-stone-500" />
          <span>Aborted</span>
        </span>
      );
  }
};

export const IncidentPanel: React.FC<IncidentPanelProps> = ({
  incidents,
  onRecoveryStarted,
  onError,
}) => {
  const [startingId, setStartingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleStartRecovery = async (incidentId: string) => {
    setStartingId(incidentId);
    try {
      await api.startRecovery(incidentId);
      onRecoveryStarted();
    } catch (err: any) {
      onError(err.message || 'Failed to start recovery');
    } finally {
      setStartingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-white border border-[#E7E2D9] rounded-xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-brand-50 rounded-lg border border-brand-200">
            <Activity className="w-4 h-4 text-brand-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#1C130D]">
            Incident Log & Recovery Orchestration
          </h3>
        </div>
        <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          Total: {incidents.length}
        </span>
      </div>

      {incidents.length === 0 ? (
        <div className="py-12 text-center text-stone-500 flex flex-col items-center justify-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-600/70 stroke-[1.5]" />
          <p className="text-xs font-medium text-stone-600">No incidents recorded.</p>
          <p className="text-[11px] text-stone-400">
            Use the simulation panel to trigger a simulated failure.
          </p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
          {incidents.map((incident) => {
            const isStarting = startingId === incident.id;
            const isExpanded = expandedId === incident.id;
            const canStart =
              incident.status === 'open' || incident.status === 'failed';

            return (
              <div
                key={incident.id}
                className="bg-stone-50 border border-[#E7E2D9] rounded-xl p-3.5 space-y-3 transition hover:border-stone-300"
              >
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-[#1C130D] font-mono">
                        Root: {incident.failed_service}
                      </span>
                      {getStatusBadge(incident.status)}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1 font-mono">
                      ID: {incident.id.slice(0, 13)}...
                    </p>
                  </div>

                  <div className="text-right text-[11px] text-stone-500 space-y-0.5">
                    <div className="flex items-center justify-end space-x-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>
                    {incident.total_recovery_duration_seconds !== null &&
                      incident.total_recovery_duration_seconds !== undefined && (
                        <div className="text-brand-700 font-mono text-[10px] font-semibold">
                          Duration: {incident.total_recovery_duration_seconds.toFixed(2)}s
                        </div>
                      )}
                  </div>
                </div>

                {/* Affected Services */}
                <div>
                  <span className="text-[11px] font-medium text-stone-600 block mb-1">
                    Affected Downstream Services:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {incident.affected_services.map((svc) => (
                      <span
                        key={svc}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          svc === incident.failed_service
                            ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Controls & Accordion */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E7E2D9]">
                  <button
                    onClick={() => toggleExpand(incident.id)}
                    className="flex items-center space-x-1 text-xs text-stone-600 hover:text-[#1C130D] transition"
                  >
                    <Layers className="w-3.5 h-3.5 text-brand-600" />
                    <span>
                      {incident.recovery_steps?.length || 0} Recovery Step
                      {incident.recovery_steps?.length === 1 ? '' : 's'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {canStart && (
                    <button
                      onClick={() => handleStartRecovery(incident.id)}
                      disabled={isStarting}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      {isStarting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>Execute Recovery Plan</span>
                    </button>
                  )}
                </div>

                {/* Detailed Steps Accordion */}
                {isExpanded && (
                  <div className="pt-2 space-y-2 text-xs border-t border-[#E7E2D9]">
                    {incident.recovery_steps && incident.recovery_steps.length > 0 ? (
                      <div className="bg-white rounded-lg p-3 space-y-2 border border-[#E7E2D9] font-mono text-[11px]">
                        {incident.recovery_steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between border-b border-[#F0EBE1] pb-2 last:border-0 last:pb-0"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-brand-700 font-bold">
                                  #{idx + 1} {step.service}
                                </span>
                                <span className="text-stone-400 text-[10px]">
                                  ({step.action || 'action'})
                                </span>
                              </div>
                              {step.reason && (
                                <p className="text-rose-600 text-[10px] mt-0.5">
                                  {step.reason}
                                </p>
                              )}
                              {step.health_check && (
                                <p className="text-emerald-700 text-[10px] mt-0.5">
                                  Probe: {step.health_check.message}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
                                step.status === 'healthy'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-400 text-[11px] italic">
                        Recovery not started yet. Click &quot;Execute Recovery Plan&quot; to begin.
                      </p>
                    )}
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

