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
      className={`border rounded-xl p-5 shadow-sm transition ${
        approvals.length > 0
          ? 'bg-amber-50/60 border-amber-300 shadow-amber-500/5'
          : 'bg-white border-[#E7E2D9]'
      }`}
    >
      <div
        className={`flex items-center justify-between border-b pb-3 mb-4 ${
          approvals.length > 0 ? 'border-amber-200' : 'border-[#F0EBE1]'
        }`}
      >
        <div className="flex items-center space-x-2">
          <div
            className={`p-1.5 rounded-lg border ${
              approvals.length > 0
                ? 'bg-amber-100 border-amber-200'
                : 'bg-stone-100 border-stone-200'
            }`}
          >
            <ShieldAlert
              className={`w-4 h-4 ${
                approvals.length > 0 ? 'text-amber-700 animate-pulse' : 'text-stone-500'
              }`}
            />
          </div>
          <h3 className="text-sm font-semibold text-[#1C130D]">
            Human Approval Center
          </h3>
          {approvals.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
              {approvals.length} Pending Decision
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          Safety Gate
        </span>
      </div>

      {approvals.length === 0 ? (
        <div className="py-8 text-center text-stone-500 flex flex-col items-center justify-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-stone-400 stroke-[1.5]" />
          <p className="text-xs font-medium text-stone-600">No high-risk actions currently pending approval.</p>
          <p className="text-[11px] text-stone-400">
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
                className="bg-white border border-amber-300 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-amber-900 uppercase font-mono">
                        {approval.service}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                        {approval.risk_level}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#1C130D] mt-1">
                      Action: {approval.action}
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {approval.description}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1 text-[11px] text-stone-500 bg-stone-50 border border-stone-200 px-2 py-1 rounded">
                    <Clock className="w-3 h-3 text-stone-400" />
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
                    className="w-full bg-stone-50 border border-[#E7E2D9] rounded-lg px-3 py-1.5 text-xs text-[#1C130D] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={isWorking}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
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
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-rose-50 border border-[#E7E2D9] hover:border-rose-300 text-stone-700 hover:text-rose-700 text-xs font-semibold transition disabled:opacity-50"
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
