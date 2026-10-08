import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileCheck2,
} from 'lucide-react';

import { Approval } from '../types';
import { api } from '../services/api';

interface ApprovalCenterProps {
  approvals: Approval[];
  onActionComplete: () => void;
  onError: (msg: string) => void;
}

export const ApprovalCenter: React.FC<ApprovalCenterProps> = ({
  approvals,
  onActionComplete,
  onError,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({});

  const handleApprove = async (approvalId: string) => {
    setProcessingId(approvalId);
    try {
      const reason = decisionReason[approvalId] || 'Approved by operator via dashboard';
      await api.approveAction(approvalId, reason);
      onActionComplete();
    } catch (err: any) {
      onError(err.message || 'Failed to approve action');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    setProcessingId(approvalId);
    try {
      const reason = decisionReason[approvalId] || 'Rejected by operator via dashboard';
      await api.rejectAction(approvalId, reason);
      onActionComplete();
    } catch (err: any) {
      onError(err.message || 'Failed to reject action');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className={`border rounded-xl p-4 shadow-sm transition ${
        approvals.length > 0
          ? 'bg-amber-950/20 border-amber-500/60 shadow-amber-500/5'
          : 'bg-[#0f172a] border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <ShieldAlert
            className={`w-4 h-4 ${
              approvals.length > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'
            }`}
          />
          <h3 className="text-sm font-semibold text-white">
            Human Approval Center
          </h3>
          {approvals.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
              {approvals.length} Pending Decision
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 font-['JetBrains_Mono']">
          Safety Gate
        </span>
      </div>

      {approvals.length === 0 ? (
        <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-slate-600 stroke-[1.5]" />
          <p className="text-xs">No high-risk actions currently pending approval.</p>
          <p className="text-[11px] text-slate-600">
            High-risk recovery actions (such as database restores) will pause here for operator sign-off.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const isWorking = processingId === approval.id;

            return (
              <div
                key={approval.id}
                className="bg-slate-900/90 border border-amber-600/40 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-amber-400 uppercase font-['JetBrains_Mono']">
                        {approval.service}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-950 text-amber-300 border border-amber-800">
                        {approval.risk_level}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mt-1">
                      Action: {approval.action}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {approval.description}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(approval.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Reason Input */}
                <div>
                  <input
                    type="text"
                    placeholder="Decision note (optional, e.g. 'Backup verified healthy')..."
                    value={decisionReason[approval.id] || ''}
                    onChange={(e) =>
                      setDecisionReason({
                        ...decisionReason,
                        [approval.id]: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={isWorking}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                  >
                    {isWorking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Approve & Resume Recovery</span>
                  </button>

                  <button
                    onClick={() => handleReject(approval.id)}
                    disabled={isWorking}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-800 text-slate-300 hover:text-rose-300 text-xs font-semibold transition disabled:opacity-50"
                  >
                    {isWorking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span>Reject & Abort</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
