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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5 mb-1">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-['JetBrains_Mono']">
              Recovery Plan: {plan.service}
            </h3>
            <p className="text-xs text-slate-400">
              Dependency-ordered sequential restoration sequence
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs text-slate-300">
            If <span className="font-mono text-cyan-300 font-semibold">{plan.service}</span> fails, the following <span className="font-bold text-white">{plan.recovery_order.length}</span> services must be restored sequentially to prevent cascading outages:
          </p>

          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-3.5 divide-y divide-slate-800">
            {plan.recovery_order.map((service, idx) => {
              const isRoot = idx === 0;
              const isHighRisk = service === 'database';

              return (
                <div
                  key={service}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-cyan-400 text-xs font-bold font-['JetBrains_Mono'] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-white font-['JetBrains_Mono']">
                          {service}
                        </span>
                        {isRoot && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                            Root Cause
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {isRoot
                          ? 'Deepest dependency — must be recovered first'
                          : `Downstream dependent (step ${idx + 1})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {isHighRisk ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center space-x-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>High Risk (Approval Req.)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Safe (Auto)</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-800/60 text-[11px] text-slate-400 flex items-start space-x-2">
            <span className="text-cyan-400 font-bold font-mono mt-0.5">ℹ</span>
            <span>
              Each step verifies upstream dependency health gates before executing the simulated playbook action and validating synthetic health probes.
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
