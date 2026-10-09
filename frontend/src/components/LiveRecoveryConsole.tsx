import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Shield,
  Terminal,
  FileCode,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Incident, RecoveryJob } from '../types';
import { api } from '../services/api';

interface LiveRecoveryConsoleProps {
  incident: Incident;
  onOpenCodeReview?: (incidentId: string) => void;
}

const STAGES = [
  { id: 'detecting', label: 'Detecting' },
  { id: 'analyzing', label: 'Analyzing' },
  { id: 'planning', label: 'Planning' },
  { id: 'awaiting_approval', label: 'Approval Gate' },
  { id: 'executing', label: 'Executing' },
  { id: 'verifying', label: 'Verifying' },
  { id: 'succeeded', label: 'Succeeded' },
];

export const LiveRecoveryConsole: React.FC<LiveRecoveryConsoleProps> = ({
  incident,
  onOpenCodeReview,
}) => {
  const [job, setJob] = useState<RecoveryJob | null>(null);
  const [isLogsExpanded, setIsLogsExpanded] = useState<boolean>(true);

  const fetchJobStatus = async () => {
    try {
      const res = await api.getRecoveryStatus(incident.id);
      if (res.job) {
        setJob(res.job);
      }
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchJobStatus();
    const interval = setInterval(() => {
      if (incident.status === 'recovering' || incident.status === 'awaiting_approval' || (job && !job.completed_at)) {
        fetchJobStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [incident.id, incident.status]);

  const currentStage = (job?.stage || (incident.status === 'awaiting_approval' ? 'awaiting_approval' : incident.status === 'resolved' ? 'succeeded' : incident.status === 'failed' ? 'failed' : 'detecting')).toLowerCase();

  const getStageIndex = (st: string) => {
    if (st === 'running' || st === 'executing') return 4;
    if (st === 'verifying') return 5;
    if (st === 'succeeded' || st === 'resolved') return 6;
    if (st === 'failed' || st === 'aborted') return 6;
    if (st === 'awaiting_approval') return 3;
    if (st === 'planning') return 2;
    if (st === 'analyzing') return 1;
    return 0;
  };

  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="bg-[#1C130D] text-stone-200 border border-[#2C1E16] rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3.5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#D95A1E] text-white flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white font-mono tracking-tight">
                AI RECOVERY ORCHESTRATION CONSOLE
              </span>
              <span className="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-stone-800 text-stone-300 border border-stone-700">
                {incident.id}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-sans">
              Autonomous root-cause resolution, dependency-aware gating, and live verification.
            </p>
          </div>
        </div>

        {/* Current Stage Badge */}
        <div className="flex items-center space-x-2">
          {job?.id && (
            <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
              JOB: {job.id.slice(0, 8)}...
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center space-x-1.5 border ${
              currentStage === 'succeeded' || incident.status === 'resolved'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                : currentStage === 'failed' || incident.status === 'failed'
                ? 'bg-rose-950/80 text-rose-400 border-rose-800'
                : currentStage === 'awaiting_approval'
                ? 'bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse'
                : 'bg-[#2A1D15] text-[#D95A1E] border-[#D95A1E]/50 animate-pulse'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            <span>STAGE: {currentStage.toUpperCase()}</span>
          </span>
        </div>
      </div>

      {/* Stage Progression Stepper */}
      <div className="bg-[#241912] p-3 rounded-xl border border-stone-800/80">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
          {STAGES.map((st, idx) => {
            const isDone = idx < currentIdx || currentStage === 'succeeded';
            const isCurrent = idx === currentIdx && currentStage !== 'succeeded';
            const isFailed = (currentStage === 'failed' || currentStage === 'aborted') && idx === currentIdx;

            return (
              <div
                key={st.id}
                className={`p-2 rounded-lg border text-[11px] font-mono transition-all ${
                  isFailed
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                    : isDone
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                    : isCurrent
                    ? 'bg-[#D95A1E]/20 border-[#D95A1E] text-white font-bold shadow-xs'
                    : 'bg-stone-900/40 border-stone-800/60 text-stone-500'
                }`}
              >
                <div className="flex items-center justify-center space-x-1 mb-1">
                  {isFailed ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#D95A1E] animate-spin" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full bg-stone-800 text-[9px] flex items-center justify-center text-stone-400">
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span className="block truncate">{st.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diagnostics & Root Cause Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Root Cause & Topology Box */}
        <div className="bg-[#241912] p-3.5 rounded-xl border border-stone-800 space-y-2">
          <div className="flex items-center space-x-2 text-stone-400 text-[11px] font-bold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-[#D95A1E]" />
            <span>Root Cause & Dependency Topology</span>
          </div>
          <div className="space-y-1.5 text-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-500">Failed Service:</span>
              <span className="font-bold text-white">{incident.failed_service}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Recovery Order:</span>
              <span className="font-mono text-emerald-400">
                {incident.recovery_order && incident.recovery_order.length > 0
                  ? incident.recovery_order.join(' → ')
                  : incident.failed_service}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Blast Radius:</span>
              <span className="text-amber-400">
                {incident.affected_services?.length || 0} dependent services
              </span>
            </div>
          </div>
        </div>

        {/* Strategy & Verification Box */}
        <div className="bg-[#241912] p-3.5 rounded-xl border border-stone-800 space-y-2">
          <div className="flex items-center space-x-2 text-stone-400 text-[11px] font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Strategy & Allowlisted Action</span>
          </div>
          <div className="space-y-1.5 text-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-500">Action Type:</span>
              <span className="font-bold text-[#D95A1E]">
                {job?.recovery_strategy?.type?.toUpperCase() || 'RUNTIME RECOVERY'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Playbook:</span>
              <span className="font-mono text-white">
                {job?.action || 'restart_service'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Verification Probe:</span>
              <span className={job?.health_check_result?.passed ? 'text-emerald-400' : 'text-stone-400'}>
                {job?.health_check_result?.message || 'HTTP 200 OK Probe Configured'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Live Event Log Stream */}
      <div className="bg-[#140D08] rounded-xl border border-stone-800/90 overflow-hidden">
        <div
          onClick={() => setIsLogsExpanded(!isLogsExpanded)}
          className="flex items-center justify-between px-3.5 py-2.5 bg-[#1E140E] border-b border-stone-800/80 cursor-pointer"
        >
          <div className="flex items-center space-x-2 text-stone-300">
            <Terminal className="w-3.5 h-3.5 text-[#D95A1E]" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Telemetry & Orchestration Event Log
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-stone-500">
              {job?.logs?.length || 1} event(s)
            </span>
            {isLogsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            )}
          </div>
        </div>

        {isLogsExpanded && (
          <div className="p-3 max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] text-stone-300 bg-black/40 scrollbar-thin">
            {job?.logs && job.logs.length > 0 ? (
              job.logs.map((log, idx) => {
                const isErr = log.includes('[FAILED]') || log.includes('error') || log.includes('failed');
                const isSucc = log.includes('[SUCCEEDED]') || log.includes('passed') || log.includes('verified');
                const isExec = log.includes('[EXECUTING]') || log.includes('[VERIFYING]');

                return (
                  <div
                    key={idx}
                    className={`flex items-start space-x-2 leading-relaxed ${
                      isErr
                        ? 'text-rose-400'
                        : isSucc
                        ? 'text-emerald-300'
                        : isExec
                        ? 'text-amber-300'
                        : 'text-stone-300'
                    }`}
                  >
                    <span className="text-stone-600 select-none">{'>'}</span>
                    <span className="break-all">{log}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-stone-500 italic">No events logged yet.</div>
            )}
          </div>
        )}
      </div>

      {/* Code Review Action Footer if source-code patch is available */}
      {onOpenCodeReview && (
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-stone-400 font-sans">
            Source-code diff preview available for inspection.
          </span>
          <button
            onClick={() => onOpenCodeReview(incident.id)}
            className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-mono text-xs font-semibold flex items-center space-x-2 transition border border-stone-700 shadow-xs cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-[#D95A1E]" />
            <span>Launch Codex-Style Code Review</span>
          </button>
        </div>
      )}
    </div>
  );
};
