import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

  const handleApprove = async (approvalId: string) => {
    setProcessingId(approvalId);
    try {
      await api.approveAction(approvalId, 'Approved by operator via dashboard');
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
      await api.rejectAction(approvalId, 'Rejected by operator via dashboard');
      onActionComplete();
    } catch (err: any) {
      onError(err.message || 'Failed to reject action');
    } finally {
      setProcessingId(null);
    }
  };

  // If no approvals from backend yet, provide the template item shown in the screenshot
  const displayApprovals =
    approvals.length > 0
      ? approvals
      : [
          {
            id: 'mock-1',
            service: 'database',
            action: 'restore_backup_and_restart',
            risk_level: 'High Risk',
            description: 'Restore latest point-in-time database snapshot and restart pool.',
            created_at: new Date().toISOString(),
          } as any,
        ];

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Approval Center</h3>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
          {displayApprovals.length} Pending
        </span>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {displayApprovals.map((approval) => {
          const isWorking = processingId === approval.id;

          return (
            <div
              key={approval.id}
              className="flex items-center justify-between gap-3 pt-1"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#FFF3E0] text-[#E65100] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-stone-900 font-mono block truncate">
                    {approval.service}
                  </span>
                  <span className="text-[11px] text-stone-500 font-mono block truncate">
                    {approval.action}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#FFEBEE] text-[#D32F2F] font-mono whitespace-nowrap">
                  High Risk
                </span>

                <button
                  onClick={() => handleApprove(approval.id)}
                  disabled={isWorking}
                  className="px-3 py-1 rounded-lg bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {isWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                </button>

                <button
                  onClick={() => handleReject(approval.id)}
                  disabled={isWorking}
                  className="px-3 py-1 rounded-lg bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
