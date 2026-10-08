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
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-rose-950 text-rose-400 border border-rose-800 flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>Open</span>
        </span>
      );
    case 'recovering':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Recovering</span>
        </span>
      );
    case 'awaiting_approval':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1 animate-bounce">
          <ShieldAlert className="w-3 h-3" />
          <span>Awaiting Approval</span>
        </span>
      );
    case 'resolved':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
          <CheckCircle className="w-3 h-3" />
          <span>Resolved</span>
        </span>
      );
    case 'failed':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1">
          <XCircle className="w-3 h-3" />
          <span>Failed</span>
        </span>
      );
    case 'aborted':
      return (
        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1">
          <XCircle className="w-3 h-3" />
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
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">
            Incident Log & Recovery Orchestration
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-['JetBrains_Mono']">
          Total: {incidents.length}
        </span>
      </div>

      {incidents.length === 0 ? (
        <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-500/40 stroke-[1.5]" />
          <p className="text-xs">No incidents recorded.</p>
          <p className="text-[11px] text-slate-600">
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
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3 transition"
              >
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-white font-['JetBrains_Mono']">
                        Root: {incident.failed_service}
                      </span>
                      {getStatusBadge(incident.status)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      ID: {incident.id.slice(0, 13)}...
                    </p>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 space-y-0.5">
                    <div className="flex items-center justify-end space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>
                    {incident.total_recovery_duration_seconds !== null &&
                      incident.total_recovery_duration_seconds !== undefined && (
                        <div className="text-cyan-400 font-mono text-[10px]">
                          Duration: {incident.total_recovery_duration_seconds.toFixed(2)}s
                        </div>
                      )}
                  </div>
                </div>

                {/* Affected Services */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Affected Downstream Services:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {incident.affected_services.map((svc) => (
                      <span
                        key={svc}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          svc === incident.failed_service
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                        }`}
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Controls & Accordion */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => toggleExpand(incident.id)}
                    className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
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
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
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
                  <div className="pt-2 space-y-2 text-xs border-t border-slate-800">
                    {incident.recovery_steps && incident.recovery_steps.length > 0 ? (
                      <div className="bg-slate-950 rounded-lg p-2.5 space-y-2 border border-slate-800/60 font-mono text-[11px]">
                        {incident.recovery_steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between border-b border-slate-900 pb-1.5 last:border-0 last:pb-0"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-cyan-400 font-bold">
                                  #{idx + 1} {step.service}
                                </span>
                                <span className="text-slate-500 text-[10px]">
                                  ({step.action || 'action'})
                                </span>
                              </div>
                              {step.reason && (
                                <p className="text-rose-400 text-[10px] mt-0.5">
                                  {step.reason}
                                </p>
                              )}
                              {step.health_check && (
                                <p className="text-emerald-400 text-[10px] mt-0.5">
                                  Probe: {step.health_check.message}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                                step.status === 'healthy'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-rose-950 text-rose-400'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[11px] italic">
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

