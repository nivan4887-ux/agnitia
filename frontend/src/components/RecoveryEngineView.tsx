import React, { useState, useEffect } from 'react';
import {
  Flame,
  ShieldCheck,
  ShieldAlert,
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
  Play,
  FileCode,
} from 'lucide-react';
import {
  RecoveryAssessment,
  ServiceHealth,
  Incident,
  Approval,
} from '../types';
import { api } from '../services/api';

interface RecoveryEngineViewProps {
  services: Record<string, ServiceHealth>;
  incidents: Incident[];
  pendingApprovals: Approval[];
  selectedService: string;
  onSelectService: (service: string) => void;
  onExecuteRecovery: (incidentId: string) => void;
  onInspectPlan: (service: string) => void;
  onRefresh: () => void;
  onError: (msg: string) => void;
  isExecuting?: boolean;
}

export const RecoveryEngineView: React.FC<RecoveryEngineViewProps> = ({
  services,
  incidents,
  pendingApprovals,
  selectedService,
  onSelectService,
  onExecuteRecovery,
  onInspectPlan,
  onRefresh,
  onError,
  isExecuting = false,
}) => {
  const [assessment, setAssessment] = useState<RecoveryAssessment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [cachedFingerprint, setCachedFingerprint] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const serviceNames = Object.keys(services);
  const activeIncidents = incidents.filter(
    (i) =>
      i.status === 'open' ||
      i.status === 'recovering' ||
      i.status === 'awaiting_approval' ||
      i.status === 'failed'
  );

  const runAssessment = async (incId?: string, svcName?: string) => {
    setIsLoading(true);
    try {
      const targetInc = incId !== undefined ? incId : selectedIncidentId;
      const targetSvc = svcName !== undefined ? svcName : selectedService;

      const result = await api.assessRecovery({
        service: targetInc ? undefined : targetSvc,
        incident_id: targetInc || undefined,
        expected_state_fingerprint: cachedFingerprint || undefined,
      });

      setAssessment(result);
      setCachedFingerprint(result.state_fingerprint);
    } catch (err: any) {
      onError(err.message || 'Failed to evaluate recovery risk assessment');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runAssessment();
  }, [selectedService, selectedIncidentId]);

  const handleApprove = async (approvalId: string) => {
    setApprovingId(approvalId);
    try {
      await api.approveAction(approvalId, 'Authorized via Recovery Engine Risk Gate');
      onRefresh();
      runAssessment();
    } catch (err: any) {
      onError(err.message || 'Approval submission failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    setApprovingId(approvalId);
    try {
      await api.rejectAction(approvalId, 'Rejected by operator');
      onRefresh();
      runAssessment();
    } catch (err: any) {
      onError(err.message || 'Rejection submission failed');
    } finally {
      setApprovingId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase rounded-lg bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] flex items-center space-x-1.5 shadow-2xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D32]" />
            <span>READY TO RECOVER</span>
          </span>
        );
      case 'NEEDS_APPROVAL':
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase rounded-lg bg-[#FFF8E1] text-[#F57F17] border border-[#FFECB3] flex items-center space-x-1.5 shadow-2xs animate-pulse font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-[#F57F17]" />
            <span>NEEDS APPROVAL</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase rounded-lg bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] flex items-center space-x-1.5 shadow-2xs font-mono">
            <ShieldX className="w-3.5 h-3.5 text-[#D32F2F]" />
            <span>RECOVERY BLOCKED</span>
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
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] font-mono">
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] font-mono">
            MEDIUM RISK
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] font-mono">
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
      case 'error':
        return <XCircle className="w-4 h-4 text-[#D32F2F] shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#E65100] shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-stone-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#D95A1E] text-white flex items-center justify-center shadow-md">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Recovery Engine & Risk Gate
            </h2>
            <p className="text-xs text-stone-500">
              Deterministic pre-flight checks, dependency prerequisite gating, and allowlisted recovery.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {assessment && (
            <div className="flex items-center space-x-2">
              {getStatusBadge(assessment.readiness_status)}
              {getRiskBadge(assessment.risk_level)}
            </div>
          )}
          <button
            onClick={() => runAssessment()}
            disabled={isLoading}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200/80 text-stone-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#D95A1E]' : ''}`} />
            <span>Re-Assess</span>
          </button>
        </div>
      </div>

      {/* Target Topology & Incident Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-stone-200/90 rounded-xl p-4 shadow-xs">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            1. Select Target Service to Evaluate:
          </label>
          <select
            value={selectedService}
            onChange={(e) => {
              onSelectService(e.target.value);
              setSelectedIncidentId('');
            }}
            disabled={isLoading}
            className="w-full bg-stone-50 border border-stone-200/80 rounded-lg px-3 py-2 text-xs text-stone-900 font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#D95A1E]"
          >
            {serviceNames.map((s) => (
              <option key={s} value={s}>
                {s} ({services[s] || 'healthy'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            2. Or Evaluate Context of an Active Incident:
          </label>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            disabled={isLoading}
            className="w-full bg-stone-50 border border-[#E7E2D9] rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#D95A1E]"
          >
            <option value="">None (Evaluate standalone topology)</option>
            {activeIncidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                INC-{inc.id.slice(0, 8).toUpperCase()} - {inc.failed_service} ({inc.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Assessment Body */}
      {assessment ? (
        <div className="space-y-5">
          {/* Executive Recommendation Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-start space-x-3 ${
              assessment.readiness_status === 'READY'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : assessment.readiness_status === 'NEEDS_APPROVAL'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {assessment.readiness_status === 'READY' ? (
              <CheckCircle2 className="w-5 h-5 text-[#2E7D32] shrink-0 mt-0.5" />
            ) : assessment.readiness_status === 'NEEDS_APPROVAL' ? (
              <ShieldAlert className="w-5 h-5 text-[#E65100] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-[#D32F2F] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-bold">{assessment.summary}</h4>
              <p className="text-xs">
                <span className="font-semibold">Recommended Action: </span>
                {assessment.recommended_next_step}
              </p>
            </div>
          </div>

          {/* Topological Sequence & Blast Radius */}
          {assessment.recovery_order && assessment.recovery_order.length > 0 && (
            <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#D95A1E]" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Dependency-Safe Recovery Sequence
                  </h3>
                </div>
                <span className="text-xs font-mono text-stone-500">
                  Total Sequence: {assessment.recovery_order.length} services
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {assessment.recovery_order.map((step, idx) => (
                  <React.Fragment key={step}>
                    <div
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border flex items-center space-x-1.5 ${
                        step === assessment.target_service
                          ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-2xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200/80'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-black/10 text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                    {idx < assessment.recovery_order!.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Pending Approvals Queue */}
          {pendingApprovals.length > 0 && (
            <div className="bg-white border border-[#FFECB3] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-[#E65100]">
                <Lock className="w-4 h-4" />
                <h3 className="text-sm font-bold text-stone-900">
                  Human-in-the-Loop Approvals Required ({pendingApprovals.length})
                </h3>
              </div>

              <div className="space-y-3">
                {pendingApprovals.map((appr) => (
                  <div
                    key={appr.id}
                    className="bg-amber-50/60 border border-[#FFE0B2] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-stone-900 font-mono text-xs">
                          {appr.service} ({appr.action})
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]">
                          HIGH RISK
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{appr.description}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleReject(appr.id)}
                        disabled={approvingId === appr.id}
                        className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(appr.id)}
                        disabled={approvingId === appr.id}
                        className="px-3.5 py-1.5 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        {approvingId === appr.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Approve & Resume</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocked Prerequisites Warnings */}
          {assessment.blocked_actions.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-[#D32F2F]">
                <XCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold">
                  Prerequisites Blocking Recovery ({assessment.blocked_actions.length})
                </h3>
              </div>
              <div className="space-y-2">
                {assessment.blocked_actions.map((b, i) => (
                  <div key={i} className="text-xs text-rose-950 font-mono bg-white/70 p-2.5 rounded-lg border border-rose-200">
                    <strong>{b.service}: </strong>
                    <span>{b.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnostic Findings */}
          {assessment.findings && assessment.findings.length > 0 && (
            <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-[#D95A1E]" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Rule Engine Diagnostics & Assertions
                  </h3>
                </div>
                <span className="text-xs font-mono text-stone-500">
                  {assessment.findings.length} rule(s) checked
                </span>
              </div>

              <div className="space-y-2">
                {assessment.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-200/80 text-xs font-mono"
                  >
                    {getSeverityIcon(f.severity)}
                    <div className="flex-1">
                      <span className="font-bold text-stone-900 mr-2">[{f.code}]</span>
                      <span className="text-stone-700">{f.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Execution Bar */}
          <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-xs text-stone-500 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Assessed at {new Date(assessment.assessed_at).toLocaleTimeString()}</span>
              <span>•</span>
              <span>Fingerprint: {assessment.state_fingerprint.slice(0, 10)}</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => onInspectPlan(selectedService || 'backend_api')}
                className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-200/80 text-stone-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-2 transition cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-stone-600" />
                <span>Inspect Playbook</span>
              </button>

              <button
                onClick={() => {
                  const targetIncId = selectedIncidentId || (activeIncidents[0]?.id ?? '');
                  onExecuteRecovery(targetIncId);
                }}
                disabled={isExecuting || assessment.readiness_status === 'BLOCKED'}
                className="px-5 py-2 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>Execute Allowlisted Recovery</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center space-y-2 text-stone-500 bg-white rounded-xl border border-stone-200/90">
          <Loader2 className="w-6 h-6 animate-spin text-[#D95A1E]" />
          <p className="text-xs font-mono">Assessing recovery readiness & prerequisite DAG...</p>
        </div>
      )}
    </div>
  );
};

