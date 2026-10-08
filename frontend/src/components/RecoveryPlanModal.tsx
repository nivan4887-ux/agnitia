import React from 'react';
import { X, Layers, ShieldAlert, CheckCircle2 } from 'lucide-react';

import { RecoveryPlanResponse } from '../types';

interface RecoveryPlanModalProps {
  plan: RecoveryPlanResponse | null;
  onClose: () => void;
}

export const RecoveryPlanModal: React.FC<RecoveryPlanModalProps> = ({
  plan,
  onClose,
}) => {
  if (!plan) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-[#E7E2D9] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5 mb-1">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1C130D] font-mono">
              Recovery Plan: {plan.service}
            </h3>
            <p className="text-xs text-stone-500">
              Dependency-ordered sequential restoration sequence
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs text-stone-600">
            If <span className="font-mono text-brand-700 font-semibold">{plan.service}</span> fails, the following <span className="font-bold text-[#1C130D]">{plan.recovery_order.length}</span> services must be restored sequentially to prevent cascading outages:
          </p>

          <div className="bg-stone-50 rounded-xl border border-[#E7E2D9] p-3.5 divide-y divide-[#E7E2D9]">
            {plan.recovery_order.map((service, idx) => {
              const isRoot = idx === 0;
              const isHighRisk = service === 'database';

              return (
                <div
                  key={service}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-white border border-[#E7E2D9] text-brand-700 text-xs font-bold font-mono flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-[#1C130D] font-mono">
                          {service}
                        </span>
                        {isRoot && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                            Root Cause
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {isRoot
                          ? 'Deepest dependency — must be recovered first'
                          : `Downstream dependent (step ${idx + 1})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {isHighRisk ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1 font-mono">
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>High Risk (Approval Req.)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1 font-mono">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Safe (Auto)</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-stone-50 rounded-lg p-3 border border-[#E7E2D9] text-[11px] text-stone-600 flex items-start space-x-2">
            <span className="text-brand-600 font-bold font-mono mt-0.5">ℹ</span>
            <span>
              Each step verifies upstream dependency health gates before executing the simulated playbook action and validating synthetic health probes.
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-[#1C130D] border border-[#E7E2D9] rounded-lg text-xs font-semibold transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
