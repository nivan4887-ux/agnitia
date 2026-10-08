import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Incident, RecoveryAssessment } from '../types';

interface CurrentIncidentCardProps {
  incident?: Incident | null;
  assessment?: RecoveryAssessment | null;
  onExecuteRecovery: (incidentId: string) => void;
  onViewDetails?: () => void;
  isExecuting?: boolean;
}

export const CurrentIncidentCard: React.FC<CurrentIncidentCardProps> = ({
  incident,
  assessment,
  onExecuteRecovery,
  onViewDetails,
  isExecuting = false,
}) => {
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(true);

  // Fallback defaults for demo view matching screenshot
  const displayId = incident?.id
    ? `INC-${incident.id.slice(0, 8).toUpperCase()}`
    : 'INC-20250516-001';
  const serviceName = incident?.failed_service || assessment?.target_service || 'backend_api';
  const statusLabel = incident?.status ? incident.status.toUpperCase() : 'OPEN';
  const detectedTime = incident?.created_at
    ? new Date(incident.created_at).toLocaleString()
    : '2025-05-16 13:21:03';
  const durationText = incident?.total_recovery_duration_seconds !== null && incident?.total_recovery_duration_seconds !== undefined
    ? `${incident.total_recovery_duration_seconds.toFixed(0)}s`
    : '10m 42s';

  const readinessStatus = assessment?.readiness_status || 'READY';
  const riskLevel = assessment?.risk_level || 'LOW';
  const playbook = 'restart_service';
  const estMTTR = '2-5 min';

  const handleStart = () => {
    if (incident?.id) {
      onExecuteRecovery(incident.id);
    } else {
      onExecuteRecovery('INC-20250516-001');
    }
  };

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Current Incident</h3>
        <button
          onClick={onViewDetails}
          className="text-xs font-semibold text-[#D95A1E] hover:underline"
        >
          View All
        </button>
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
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] uppercase">
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
              HTTP 503 Service Unavailable
            </p>
            <p className="text-[10px] text-[#D32F2F]/90">
              ERR_DB_POOL_EXHAUSTED
            </p>
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
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
              {readinessStatus}
            </span>
          </div>
          <button className="text-stone-400 hover:text-stone-600">
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
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#E8F5E9] text-[#2E7D32]">
                  {readinessStatus}
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EFEAE2]">
                <span className="text-[10px] text-stone-500 block mb-1">
                  Risk Level
                </span>
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#E8F5E9] text-[#2E7D32]">
                  {riskLevel}
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EFEAE2]">
                <span className="text-[10px] text-stone-500 block mb-1">
                  Playbook
                </span>
                <span className="text-[10px] font-mono font-semibold text-stone-800 block truncate">
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
                disabled={isExecuting}
                className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                )}
                <span>Execute Recovery Plan</span>
              </button>

              <button
                onClick={onViewDetails}
                className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 text-xs font-semibold shadow-xs transition"
              >
                <Eye className="w-3.5 h-3.5 text-stone-500" />
                <span>View Details</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

