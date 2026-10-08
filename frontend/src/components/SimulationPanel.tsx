import React, { useState } from 'react';
import {
  Flame,
  Search,
  Settings2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

import { api } from '../services/api';

interface SimulationPanelProps {
  services: string[];
  selectedService: string;
  onSelectService: (service: string) => void;
  onFailSuccess: () => void;
  onPreviewPlan: (service: string) => void;
  onError: (msg: string) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  services,
  selectedService,
  onSelectService,
  onFailSuccess,
  onPreviewPlan,
  onError,
}) => {
  const [isFailing, setIsFailing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Simulation override inputs
  const [actionSuccess, setActionSuccess] = useState(true);
  const [healthCheckSuccess, setHealthCheckSuccess] = useState(true);
  const [riskOverride, setRiskOverride] = useState<string>('default');
  const [isConfiguring, setIsConfiguring] = useState(false);

  const handleSimulateFailure = async () => {
    if (!selectedService) return;
    setIsFailing(true);
    try {
      await api.simulateFailure(selectedService);
      onFailSuccess();
    } catch (err: any) {
      onError(err.message || 'Failed to simulate failure');
    } finally {
      setIsFailing(false);
    }
  };

  const handleApplyConfig = async () => {
    if (!selectedService) return;
    setIsConfiguring(true);
    setConfigSuccess(null);
    try {
      await api.configureSimulation({
        service: selectedService,
        action_success: actionSuccess,
        health_check_success: healthCheckSuccess,
        risk_level: riskOverride === 'default' ? undefined : riskOverride,
      });
      setConfigSuccess(`Simulation configured for ${selectedService}`);
      setTimeout(() => setConfigSuccess(null), 3000);
    } catch (err: any) {
      onError(err.message || 'Failed to configure simulation');
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Flame className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-white">
            Incident Simulation & Planning
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-['JetBrains_Mono']">
          Chaos & Test Control
        </span>
      </div>

      <div className="space-y-4">
        {/* Service selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Target Service
          </label>
          <div className="flex space-x-2">
            <select
              value={selectedService}
              onChange={(e) => onSelectService(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-['JetBrains_Mono'] focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
            >
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleSimulateFailure}
            disabled={isFailing || !selectedService}
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-medium text-xs shadow-md shadow-rose-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFailing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Flame className="w-4 h-4 text-rose-200" />
            )}
            <span>Simulate Failure</span>
          </button>

          <button
            onClick={() => onPreviewPlan(selectedService)}
            disabled={!selectedService}
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition disabled:opacity-50"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Preview Plan</span>
          </button>
        </div>

        {/* Collapsible Simulation Injection Config */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition"
          >
            <div className="flex items-center space-x-1.5">
              <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulated Outcomes & Injection (Testing)</span>
            </div>
            {showConfig ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showConfig && (
            <div className="mt-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-3 text-xs">
              <p className="text-slate-400 text-[11px]">
                Configure simulated behavior for <span className="text-cyan-300 font-mono">{selectedService}</span> to test gate failure, action errors, or custom risk gates.
              </p>

              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-slate-300">Playbook Action Success:</span>
                  <input
                    type="checkbox"
                    checked={actionSuccess}
                    onChange={(e) => setActionSuccess(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-slate-300">Health Check Probe Success:</span>
                  <input
                    type="checkbox"
                    checked={healthCheckSuccess}
                    onChange={(e) => setHealthCheckSuccess(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                </label>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300">Risk Classification:</span>
                  <select
                    value={riskOverride}
                    onChange={(e) => setRiskOverride(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
                  >
                    <option value="default">Default Playbook Risk</option>
                    <option value="safe">Force Safe (Auto-run)</option>
                    <option value="high_risk">Force High-Risk (Requires Approval)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                {configSuccess ? (
                  <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>{configSuccess}</span>
                  </span>
                ) : (
                  <span />
                )}
                <button
                  onClick={handleApplyConfig}
                  disabled={isConfiguring}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-medium transition"
                >
                  {isConfiguring ? 'Saving...' : 'Apply Override'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
