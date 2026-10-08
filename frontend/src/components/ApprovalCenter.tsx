import React, { useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
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
  const [processingState, setProcessingState] = useState<{
    id: string;
    decision: 'approve' | 'reject';
  } | null>(null);

  const handleApprove = async (approvalId: string) => {
    setProcessingState({ id: approvalId, decision: 'approve' });
    try {
      await api.approveAction(approvalId, 'Approved by operator via SRE dashboard');
      onActionComplete();
    } catch (err: any) {
      onError(err.message || 'Failed to approve action');
    } finally {
      setProcessingState(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    setProcessingState({ id: approvalId, decision: 'reject' });
    try {
      await api.rejectAction(approvalId, 'Rejected by operator via SRE dashboard');
      onActionComplete();
    } catch (err: any) {
      onError(err.message || 'Failed to reject action');
    } finally {
      setProcessingState(null);
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-[#D95A1E]" />
          <h3 className="text-sm font-bold text-stone-900">Approval Center</h3>
        </div>
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${
            pendingApprovals.length > 0
              ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2] animate-pulse'
              : 'bg-emerald-50 text-[#2E7D32] border-emerald-200'
          }`}
        >
          {pendingApprovals.length} Pending
        </span>
      </div>

      {/* Items */}
      {pendingApprovals.length === 0 ? (
        <div className="py-6 px-4 rounded-xl bg-stone-50 border border-[#EFEAE2] text-center space-y-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto" />
          <p className="text-xs font-bold text-stone-800">No Pending Approvals</p>
          <p className="text-[11px] text-stone-500 max-w-xs mx-auto leading-relaxed">
            High-risk operations (such as database snapshot restorations or payment provider failovers) will pause here for operator sign-off before executing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingApprovals.map((approval) => {
            const isWorking = processingState?.id === approval.id;
            const isApproving = isWorking && processingState?.decision === 'approve';
            const isRejecting = isWorking && processingState?.decision === 'reject';

            return (
              <div
                key={approval.id}
                className="p-3.5 rounded-xl border border-[#FFE0B2] bg-[#FFFDF9] space-y-2.5 transition hover:border-[#D95A1E]/40 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#FFF3E0] text-[#E65100] flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-stone-900 font-mono block truncate">
                          {approval.service}
                        </span>
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] font-mono whitespace-nowrap uppercase">
                          {approval.risk_level || 'High Risk'}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-600 font-mono font-semibold block truncate">
                        {approval.action}
                      </span>
                    </div>
                  </div>
                </div>

                {approval.description && (
                  <p className="text-[11px] text-stone-600 leading-relaxed font-sans bg-white/80 p-2 rounded-lg border border-[#EFEAE2]">
                    {approval.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[#F5EFE6]">
                  <button
                    onClick={() => handleReject(approval.id)}
                    disabled={isWorking}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-[#E7E2D9] text-stone-700 text-xs font-semibold shadow-2xs transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isRejecting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-stone-600" />
                    ) : null}
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={isWorking}
                    className="px-3.5 py-1.5 rounded-lg bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isApproving ? (
                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    <span>Approve Action</span>
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
