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
    <div className="bg-white border border-[#E7E2D9] rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-rose-50 rounded-lg border border-rose-100">
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#1C130D]">
            Incident Simulation & Planning
          </h3>
        </div>
        <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          Chaos Control
        </span>
      </div>

      <div className="space-y-4">
        {/* Service selector */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Target Service
          </label>
          <div className="flex space-x-2">
            <select
              value={selectedService}
              onChange={(e) => onSelectService(e.target.value)}
              className="w-full bg-stone-50 border border-[#E7E2D9] rounded-lg px-3 py-2 text-xs font-mono text-[#1C130D] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
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
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFailing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Flame className="w-4 h-4 text-rose-100" />
            )}
            <span>Simulate Failure</span>
          </button>

          <button
            onClick={() => onPreviewPlan(selectedService)}
            disabled={!selectedService}
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-white hover:bg-stone-50 border border-[#E7E2D9] text-[#1C130D] font-medium text-xs shadow-sm transition disabled:opacity-50"
          >
            <Search className="w-4 h-4 text-brand-600" />
            <span>Preview Plan</span>
          </button>
        </div>

        {/* Collapsible Simulation Injection Config */}
        <div className="pt-2 border-t border-[#F0EBE1]">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-between text-xs text-stone-600 hover:text-[#1C130D] py-1 transition"
          >
            <div className="flex items-center space-x-1.5">
              <Settings2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Simulated Outcomes & Injection (Testing)</span>
            </div>
            {showConfig ? (
              <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            )}
          </button>

          {showConfig && (
            <div className="mt-3 p-3.5 bg-stone-50 rounded-lg border border-[#E7E2D9] space-y-3 text-xs">
              <p className="text-stone-600 text-[11px] leading-relaxed">
                Configure simulated behavior for <span className="text-brand-700 font-mono font-semibold">{selectedService}</span> to test gate failure, action errors, or custom risk gates.
              </p>

              <div className="space-y-2">
                <label className="flex items-center justify-between text-stone-700">
                  <span>Playbook Action Success:</span>
                  <input
                    type="checkbox"
                    checked={actionSuccess}
                    onChange={(e) => setActionSuccess(e.target.checked)}
                    className="rounded border-[#E7E2D9] text-brand-600 focus:ring-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between text-stone-700">
                  <span>Health Check Probe Success:</span>
                  <input
                    type="checkbox"
                    checked={healthCheckSuccess}
                    onChange={(e) => setHealthCheckSuccess(e.target.checked)}
                    className="rounded border-[#E7E2D9] text-brand-600 focus:ring-brand-500"
                  />
                </label>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-stone-700">Risk Classification:</span>
                  <select
                    value={riskOverride}
                    onChange={(e) => setRiskOverride(e.target.value)}
                    className="bg-white border border-[#E7E2D9] rounded px-2 py-1 text-[#1C130D] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="default">Default Playbook Risk</option>
                    <option value="safe">Force Safe (Auto-run)</option>
                    <option value="high_risk">Force High-Risk (Requires Approval)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#E7E2D9]">
                {configSuccess ? (
                  <span className="text-[11px] text-emerald-700 flex items-center space-x-1 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{configSuccess}</span>
                  </span>
                ) : (
                  <span />
                )}
                <button
                  onClick={handleApplyConfig}
                  disabled={isConfiguring}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
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
