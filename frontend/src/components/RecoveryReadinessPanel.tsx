import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Info,
  Layers,
  ArrowRight,
  Lock,
  Loader2,
  Clock,
} from 'lucide-react';
import { RecoveryAssessment, ServiceHealth, Incident } from '../types';
import { api } from '../services/api';

interface RecoveryReadinessPanelProps {
  services: string[];
  selectedService: string;
  onSelectService: (service: string) => void;
  serviceStates: Record<string, ServiceHealth>;
  incidents: Incident[];
  onStartRecovery?: (incidentId: string) => void;
  onError: (msg: string) => void;
}

export const RecoveryReadinessPanel: React.FC<RecoveryReadinessPanelProps> = ({
  services,
  selectedService,
  onSelectService,
  serviceStates,
  incidents,
  onStartRecovery,
  onError,
}) => {
  const [assessment, setAssessment] = useState<RecoveryAssessment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [cachedFingerprint, setCachedFingerprint] = useState<string | null>(null);

  const activeIncidents = incidents.filter(
    (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval' || i.status === 'failed'
  );

  const runAssessment = async (incidentIdOverride?: string, serviceOverride?: string) => {
    setIsLoading(true);
    try {
      const incId = incidentIdOverride !== undefined ? incidentIdOverride : selectedIncidentId;
      const svc = serviceOverride !== undefined ? serviceOverride : selectedService;

      const result = await api.assessRecovery({
        service: incId ? undefined : svc,
        incident_id: incId || undefined,
        expected_state_fingerprint: cachedFingerprint || undefined,
      });

      setAssessment(result);
      setCachedFingerprint(result.state_fingerprint);
    } catch (err: any) {
      onError(err.message || 'Failed to assess recovery readiness');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-run assessment when selectedService or selectedIncidentId changes
  useEffect(() => {
    runAssessment();
  }, [selectedService, selectedIncidentId]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center space-x-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>READY</span>
          </span>
        );
      case 'NEEDS_APPROVAL':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-amber-950 text-amber-300 border border-amber-700 flex items-center space-x-1.5 shadow-sm animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>NEEDS APPROVAL</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-rose-950 text-rose-300 border border-rose-700 flex items-center space-x-1.5 shadow-sm">
            <ShieldX className="w-3.5 h-3.5 text-rose-400" />
            <span>BLOCKED</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getRiskBadge = (risk?: string) => {
    switch (risk) {
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-rose-950/80 text-rose-300 border border-rose-800">
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-amber-950/80 text-amber-300 border border-amber-800">
            MEDIUM RISK
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            LOW RISK
          </span>
        );
      default:
        return null;
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-cyan-950/80 border border-cyan-800 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
              <span>Recovery Confidence & Risk Gate</span>
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic pre-flight readiness & dependency prerequisite verification
            </p>
          </div>
        </div>

        {/* Action button & Status indicators */}
        <div className="flex items-center space-x-2">
          {assessment && (
            <>
              {getStatusBadge(assessment.readiness_status)}
              {getRiskBadge(assessment.risk_level)}
            </>
          )}
          <button
            onClick={() => runAssessment()}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            title="Re-run assessment"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isLoading ? 'Assessing...' : 'Re-assess'}</span>
          </button>
        </div>
      </div>

      {/* Target Selection Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Target Service Topology
          </label>
          <select
            value={selectedService}
            onChange={(e) => {
              onSelectService(e.target.value);
              setSelectedIncidentId('');
            }}
            disabled={isLoading}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-['JetBrains_Mono'] focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {services.map((s) => (
              <option key={s} value={s}>
                {s} ({serviceStates[s] || 'unknown'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Assess Open Incident Context (Optional)
          </label>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            disabled={isLoading}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-['JetBrains_Mono'] focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">None (Evaluate standalone topology)</option>
            {activeIncidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                #{inc.id.slice(0, 8)} - {inc.failed_service} ({inc.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !assessment && (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <p className="text-xs font-mono">Evaluating dependency prerequisites & playbooks...</p>
        </div>
      )}

      {/* Stale State Banner */}
      {assessment?.is_stale && (
        <div className="bg-amber-950/60 border border-amber-800 rounded-lg p-3 flex items-center space-x-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <strong>Stale Assessment:</strong> Service or incident state has updated since last assessment. Re-assessing automatically.
          </span>
        </div>
      )}

      {/* Assessment Body */}
      {assessment && (
        <div className="space-y-4">
          {/* Executive Summary & Recommendation Banner */}
          <div
            className={`p-3.5 rounded-lg border flex flex-col space-y-2 ${
              assessment.readiness_status === 'READY'
                ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
                : assessment.readiness_status === 'NEEDS_APPROVAL'
                ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {assessment.readiness_status === 'READY' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              )}
              {assessment.readiness_status === 'NEEDS_APPROVAL' && (
                <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              )}
              {assessment.readiness_status === 'BLOCKED' && (
                <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-100">{assessment.summary}</p>
                <p className="text-xs opacity-90">
                  <span className="font-semibold text-white">Recommended Next Step: </span>
                  {assessment.recommended_next_step}
                </p>
              </div>
            </div>
          </div>

          {/* Planned Sequence & Downstream Blast Radius */}
          {assessment.recovery_order && assessment.recovery_order.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-1.5 font-medium">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dependency-Safe Sequence</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  Blast Radius: {assessment.recovery_order.length} service(s)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {assessment.recovery_order.map((step, idx) => (
                  <React.Fragment key={step}>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                        step === assessment.target_service
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {step}
                    </span>
                    {idx < assessment.recovery_order!.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Blocked Actions / Required Approvals Warnings */}
          {assessment.blocked_actions.length > 0 && (
            <div className="bg-rose-950/40 border border-rose-900/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-300">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Blocked Prerequisites ({assessment.blocked_actions.length})</span>
              </div>
              <ul className="space-y-1.5 text-xs text-rose-200">
                {assessment.blocked_actions.map((b, i) => (
                  <li key={i} className="flex items-start space-x-1.5 font-mono text-[11px]">
                    <span className="text-rose-400">•</span>
                    <span>
                      <strong className="text-rose-100">{b.service}:</strong> {b.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.required_approvals.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-900/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-300">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Human-in-the-Loop Approvals Required ({assessment.required_approvals.length})</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-200">
                {assessment.required_approvals.map((appr, i) => (
                  <li key={i} className="flex items-start space-x-1.5 font-mono text-[11px]">
                    <span className="text-amber-400">•</span>
                    <span>
                      <strong className="text-amber-100">{appr.service}</strong> ({appr.action}) — {appr.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailed Diagnostic Findings */}
          {assessment.findings && assessment.findings.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/60">
                <div className="flex items-center space-x-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Rule Engine Diagnostics & Findings</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {assessment.findings.length} check(s) recorded
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {assessment.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 text-xs py-1 px-2 rounded bg-slate-950/50 border border-slate-800/60"
                  >
                    {getSeverityIcon(f.severity)}
                    <div className="flex-1 font-mono text-[11px]">
                      <span className="font-bold text-slate-300 mr-1.5">[{f.code}]</span>
                      <span className="text-slate-300">{f.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Action: Start Recovery if Incident is Selected and Actionable */}
          {selectedIncidentId && onStartRecovery && assessment.readiness_status !== 'BLOCKED' && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onStartRecovery(selectedIncidentId)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-md flex items-center space-x-2 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Execute Recovery for #{selectedIncidentId.slice(0, 8)}</span>
              </button>
            </div>
          )}

          {/* Assessment Timestamp & Fingerprint Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Assessed: {new Date(assessment.assessed_at).toLocaleTimeString()}</span>
            </div>
            <span>Snapshot: {assessment.state_fingerprint.slice(0, 8)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
