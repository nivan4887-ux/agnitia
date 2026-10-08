import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { RecoveryAssessment } from '../types';

interface PrerequisiteChecksCardProps {
  assessment?: RecoveryAssessment | null;
}

export const PrerequisiteChecksCard: React.FC<PrerequisiteChecksCardProps> = ({
  assessment,
}) => {
  const isBlocked = assessment?.readiness_status === 'BLOCKED';
  const fingerprint = assessment?.state_fingerprint
    ? `${assessment.state_fingerprint.slice(0, 8)}...`
    : '7f3a9c2e...';

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">
          Prerequisite Checks
        </h3>
        <span
          className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
            isBlocked
              ? 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
              : 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
          }`}
        >
          {isBlocked ? 'BLOCKED' : 'ALL CLEAR'}
        </span>
      </div>

      {/* Checklist items */}
      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-stone-800">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32] fill-[#E8F5E9] shrink-0" />
            <span className="font-medium">Upstream dependencies healthy</span>
          </div>
          <span className="font-mono text-[11px] text-stone-500">
            database, products_api
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-stone-800">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32] fill-[#E8F5E9] shrink-0" />
            <span className="font-medium">Downstream services can recover</span>
          </div>
          <span className="font-mono text-[11px] text-stone-500">
            order_service, payment_service, website
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-stone-800">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32] fill-[#E8F5E9] shrink-0" />
            <span className="font-medium">State fingerprint current</span>
          </div>
          <span className="font-mono text-[11px] text-stone-500">
            {fingerprint}
          </span>
        </div>
      </div>
    </div>
  );
};
