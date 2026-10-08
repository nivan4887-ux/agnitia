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
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center space-x-1.5 shadow-sm font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>READY</span>
          </span>
        );
      case 'NEEDS_APPROVAL':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1.5 shadow-sm animate-pulse font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>NEEDS APPROVAL</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-rose-50 text-rose-800 border border-rose-300 flex items-center space-x-1.5 shadow-sm font-mono">
            <ShieldX className="w-3.5 h-3.5 text-rose-600" />
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
          <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono">
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
            MEDIUM RISK
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
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
        return <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-stone-500 flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-white border border-[#E7E2D9] rounded-xl p-5 shadow-sm space-y-4">
      {/* Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EBE1] pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-brand-50 border border-brand-200 rounded-lg text-brand-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1C130D] tracking-tight flex items-center space-x-2">
              <span>Recovery Confidence & Risk Gate</span>
            </h3>
            <p className="text-xs text-stone-500">
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
            className="px-3 py-1.5 bg-white hover:bg-stone-50 text-[#1C130D] text-xs font-medium rounded-lg border border-[#E7E2D9] flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
            title="Re-run assessment"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-600' : 'text-stone-500'}`} />
            <span>{isLoading ? 'Assessing...' : 'Re-assess'}</span>
          </button>
        </div>
      </div>

      {/* Target Selection Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50 p-3 rounded-lg border border-[#E7E2D9]">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Target Service Topology
          </label>
          <select
            value={selectedService}
            onChange={(e) => {
              onSelectService(e.target.value);
              setSelectedIncidentId('');
            }}
            disabled={isLoading}
            className="w-full bg-white border border-[#E7E2D9] rounded-lg px-3 py-1.5 text-xs text-[#1C130D] font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
          >
            {services.map((s) => (
              <option key={s} value={s}>
                {s} ({serviceStates[s] || 'unknown'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Assess Open Incident Context (Optional)
          </label>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            disabled={isLoading}
            className="w-full bg-white border border-[#E7E2D9] rounded-lg px-3 py-1.5 text-xs text-[#1C130D] font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
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
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-stone-500">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          <p className="text-xs font-mono">Evaluating dependency prerequisites & playbooks...</p>
        </div>
      )}

      {/* Stale State Banner */}
      {assessment?.is_stale && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center space-x-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
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
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : assessment.readiness_status === 'NEEDS_APPROVAL'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {assessment.readiness_status === 'READY' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              )}
              {assessment.readiness_status === 'NEEDS_APPROVAL' && (
                <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              {assessment.readiness_status === 'BLOCKED' && (
                <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#1C130D]">{assessment.summary}</p>
                <p className="text-xs text-stone-700">
                  <span className="font-semibold text-[#1C130D]">Recommended Next Step: </span>
                  {assessment.recommended_next_step}
                </p>
              </div>
            </div>
          </div>

          {/* Planned Sequence & Downstream Blast Radius */}
          {assessment.recovery_order && assessment.recovery_order.length > 0 && (
            <div className="bg-stone-50 border border-[#E7E2D9] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <div className="flex items-center space-x-1.5 font-medium">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <span>Dependency-Safe Sequence</span>
                </div>
                <span className="font-mono text-[11px] text-stone-500">
                  Blast Radius: {assessment.recovery_order.length} service(s)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {assessment.recovery_order.map((step, idx) => (
                  <React.Fragment key={step}>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                        step === assessment.target_service
                          ? 'bg-brand-50 text-brand-900 border-brand-300 font-semibold'
                          : 'bg-white text-stone-700 border-[#E7E2D9]'
                      }`}
                    >
                      {step}
                    </span>
                    {idx < assessment.recovery_order!.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-stone-400 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Blocked Actions / Required Approvals Warnings */}
          {assessment.blocked_actions.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-800">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Blocked Prerequisites ({assessment.blocked_actions.length})</span>
              </div>
              <ul className="space-y-1.5 text-xs text-rose-900">
                {assessment.blocked_actions.map((b, i) => (
                  <li key={i} className="flex items-start space-x-1.5 font-mono text-[11px]">
                    <span className="text-rose-500">•</span>
                    <span>
                      <strong className="text-rose-950">{b.service}:</strong> {b.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.required_approvals.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-800">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Human-in-the-Loop Approvals Required ({assessment.required_approvals.length})</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-900">
                {assessment.required_approvals.map((appr, i) => (
                  <li key={i} className="flex items-start space-x-1.5 font-mono text-[11px]">
                    <span className="text-amber-500">•</span>
                    <span>
                      <strong className="text-amber-950">{appr.service}</strong> ({appr.action}) — {appr.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailed Diagnostic Findings */}
          {assessment.findings && assessment.findings.length > 0 && (
            <div className="bg-stone-50 border border-[#E7E2D9] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-600 pb-1 border-b border-[#E7E2D9]">
                <div className="flex items-center space-x-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 text-brand-600" />
                  <span>Rule Engine Diagnostics & Findings</span>
                </div>
                <span className="font-mono text-[10px] text-stone-500">
                  {assessment.findings.length} check(s) recorded
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {assessment.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 text-xs py-1.5 px-2 rounded bg-white border border-[#E7E2D9]"
                  >
                    {getSeverityIcon(f.severity)}
                    <div className="flex-1 font-mono text-[11px]">
                      <span className="font-bold text-stone-800 mr-1.5">[{f.code}]</span>
                      <span className="text-stone-700">{f.message}</span>
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
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Execute Recovery for #{selectedIncidentId.slice(0, 8)}</span>
              </button>
            </div>
          )}

          {/* Assessment Timestamp & Fingerprint Footer */}
          <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono pt-1">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-stone-400" />
              <span>Assessed: {new Date(assessment.assessed_at).toLocaleTimeString()}</span>
            </div>
            <span>Snapshot: {assessment.state_fingerprint.slice(0, 8)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
