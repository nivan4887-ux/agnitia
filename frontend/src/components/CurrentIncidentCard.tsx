import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  FileCode,
} from 'lucide-react';
import { Incident, RecoveryAssessment } from '../types';
import { LiveRecoveryConsole } from './LiveRecoveryConsole';

interface CurrentIncidentCardProps {
  incident?: Incident | null;
  assessment?: RecoveryAssessment | null;
  onExecuteRecovery: (incidentId: string) => void;
  onViewDetails?: () => void;
  onReviewCodePatch?: (incidentId: string) => void;
  isExecuting?: boolean;
}

export const CurrentIncidentCard: React.FC<CurrentIncidentCardProps> = ({
  incident,
  assessment,
  onExecuteRecovery,
  onViewDetails,
  onReviewCodePatch,
  isExecuting = false,
}) => {
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(true);

  // An incident is active only if it is open, recovering, awaiting approval, or failed
  const isActive =
    Boolean(incident) &&
    incident?.status !== 'resolved' &&
    incident?.status !== 'aborted';

  if (!incident || !isActive) {
    return (
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">Current Incident</h3>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="text-xs font-semibold text-[#D95A1E] hover:underline cursor-pointer"
            >
              View History
            </button>
          )}
        </div>

        {/* Healthy Standby State */}
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 border border-dashed border-[#E7E2D9] rounded-xl bg-stone-50/50">
          <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-1.5 text-stone-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
              <span>No Active Incidents</span>
            </div>
            <p className="text-xs text-stone-500 max-w-sm">
              All infrastructure services and application endpoints are operating within normal baseline latency and error budgets.
            </p>
          </div>
          <div className="pt-2 flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] mr-1.5 animate-pulse" />
              Continuous Health Probing Active
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Active incident display
  const displayId = incident.id.startsWith('INC-')
    ? incident.id
    : `INC-${incident.id.slice(0, 8).toUpperCase()}`;
  const serviceName = incident.failed_service || assessment?.target_service || 'unknown_service';
  const statusLabel = incident.status.toUpperCase();
  const detectedTime = incident.created_at
    ? new Date(incident.created_at).toLocaleString()
    : 'Just now';

  let durationText = 'Active';
  if (incident.total_recovery_duration_seconds !== null && incident.total_recovery_duration_seconds !== undefined) {
    durationText = `${incident.total_recovery_duration_seconds.toFixed(0)}s`;
  } else if (incident.created_at) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(incident.created_at).getTime()) / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  const latestStepReason = incident.recovery_steps && incident.recovery_steps.length > 0
    ? incident.recovery_steps[incident.recovery_steps.length - 1].reason
    : undefined;

  const readinessStatus = assessment?.readiness_status || 'READY';
  const riskLevel = assessment?.risk_level || (serviceName === 'database' ? 'HIGH' : 'LOW');
  const playbook = assessment?.recommended_next_step || (serviceName === 'database' ? 'restore_backup_and_restart' : 'restart_service');
  const estMTTR = '1-3 min';

  const handleStart = () => {
    if (incident.id) {
      onExecuteRecovery(incident.id);
    }
  };

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Current Incident</h3>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="text-xs font-semibold text-[#D95A1E] hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      {/* Incident Summary Box */}
      <div className="flex items-start space-x-3.5">
        <div className="w-9 h-9 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 fill-[#D32F2F] text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-stone-900 font-mono">
              {displayId}
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase border ${
                incident.status === 'recovering'
                  ? 'bg-[#FFF3E0] text-[#D95A1E] border-[#FFE0B2] animate-pulse'
                  : incident.status === 'awaiting_approval'
                  ? 'bg-[#FFF8E1] text-[#F57F17] border-[#FFECB3]'
                  : 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]'
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-xs font-semibold text-stone-600 font-mono mt-0.5">
            {serviceName}
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-500 font-mono mt-2">
            <div>
              <span className="text-stone-400 block text-[10px]">Detected</span>
              <span>{detectedTime}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Duration</span>
              <span className="font-semibold text-stone-700">{durationText}</span>
            </div>
          </div>

          <div className="mt-2.5 font-mono text-[11px] text-[#D32F2F] leading-tight">
            <span className="text-stone-500 font-medium">Error</span>
            <p className="font-semibold">
              {latestStepReason || 'Automated probe detected service outage'}
            </p>
            {assessment?.risk_level === 'HIGH' && (
              <p className="text-[10px] text-[#D95A1E] mt-0.5 font-medium">
                High Risk Gate: Human approval required before mutation
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recovery Assessment Accordion Section */}
      <div className="pt-3 border-t border-[#EFEAE2] space-y-3">
        <div
          onClick={() => setIsAssessmentOpen(!isAssessmentOpen)}
          className="flex items-center justify-between cursor-pointer py-1"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-stone-800">
              Recovery Assessment
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                readinessStatus === 'READY'
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]'
                  : readinessStatus === 'BLOCKED'
                  ? 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]'
                  : 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2]'
              }`}
            >
              {readinessStatus}
            </span>
          </div>
          <button className="text-stone-400 hover:text-stone-600 cursor-pointer">
            {isAssessmentOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {isAssessmentOpen && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EFEAE2]">
                <span className="text-[10px] text-stone-500 block mb-1">
                  Readiness
                </span>
                <span
                  className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    readinessStatus === 'READY'
                      ? 'bg-[#E8F5E9] text-[#2E7D32]'
                      : 'bg-[#FFEBEE] text-[#D32F2F]'
                  }`}
                >
                  {readinessStatus}
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EFEAE2]">
                <span className="text-[10px] text-stone-500 block mb-1">
                  Risk Level
                </span>
                <span
                  className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    riskLevel === 'HIGH'
                      ? 'bg-[#FFEBEE] text-[#D32F2F]'
                      : riskLevel === 'MEDIUM'
                      ? 'bg-[#FFF3E0] text-[#E65100]'
                      : 'bg-[#E8F5E9] text-[#2E7D32]'
                  }`}
                >
                  {riskLevel}
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EFEAE2]">
                <span className="text-[10px] text-stone-500 block mb-1">
                  Playbook
                </span>
                <span className="text-[10px] font-mono font-semibold text-stone-800 block truncate" title={playbook}>
                  {playbook}
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EFEAE2]">
                <span className="text-[10px] text-stone-500 block mb-1">
                  Est. MTTR
                </span>
                <span className="text-[10px] font-mono font-semibold text-stone-800 block">
                  {estMTTR}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleStart}
                disabled={isExecuting || readinessStatus === 'BLOCKED'}
                className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                )}
                <span>Execute Recovery Plan</span>
              </button>

              {onViewDetails && (
                <button
                  onClick={onViewDetails}
                  className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-stone-500" />
                  <span>View Plan</span>
                </button>
              )}
            </div>

            {onReviewCodePatch && incident && (
              <button
                onClick={() => onReviewCodePatch(incident.id)}
                className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-zinc-100 text-xs font-mono font-semibold transition cursor-pointer shadow-xs border border-stone-800"
              >
                <FileCode className="w-3.5 h-3.5 text-[#D95A1E]" />
                <span>Review Proposed Source Patch (10s Diff Preview)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Live AI Recovery Orchestration Console */}
      {(incident.status === 'recovering' || incident.status === 'awaiting_approval' || isExecuting) && (
        <div className="pt-2">
          <LiveRecoveryConsole
            incident={incident}
            onOpenCodeReview={onReviewCodePatch}
          />
        </div>
      )}
    </div>
  );
};


