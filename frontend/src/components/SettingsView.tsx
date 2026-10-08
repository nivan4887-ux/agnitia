import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Server,
  Lock,
  Zap,
  Radio,
  FileCheck2,
  HardDrive,
} from 'lucide-react';
import { api } from '../services/api';

interface SettingsViewProps {
  backendOnline: boolean;
  onRefresh: () => void;
  onError: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  backendOnline,
  onRefresh,
  onError,
}) => {
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{ status: string; latencyMs: number } | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const handlePing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await api.getHealth();
      const end = performance.now();
      setPingResult({
        status: res.status === 'ok' ? 'OK (200)' : res.status,
        latencyMs: Math.round(end - start),
      });
      onRefresh();
    } catch (err: any) {
      onError(err.message || 'API ping failed');
      setPingResult(null);
    } finally {
      setIsPinging(false);
    }
  };

  const servicesConfig = [
    {
      name: 'database',
      tier: 'Tier 0 (Storage)',
      risk: 'HIGH',
      allowlistedAction: 'restore_database',
      approvalRequired: true,
      description: 'Relational database holding core state & catalog records.',
    },
    {
      name: 'payment_service',
      tier: 'Tier 1 (Transaction)',
      risk: 'LOW',
      allowlistedAction: 'reconnect_gateway',
      approvalRequired: false,
      description: 'Payment orchestration & financial settlement connector.',
    },
    {
      name: 'products_api',
      tier: 'Tier 1 (Catalog)',
      risk: 'LOW',
      allowlistedAction: 'restore_catalog_pool',
      approvalRequired: false,
      description: 'Dedicated fashion catalog & inventory microservice.',
    },
    {
      name: 'backend_api',
      tier: 'Tier 2 (Core Application)',
      risk: 'LOW',
      allowlistedAction: 'restart_container',
      approvalRequired: false,
      description: 'Core application gateway orchestrating microservices.',
    },
    {
      name: 'website',
      tier: 'Tier 3 (Presentation)',
      risk: 'LOW',
      allowlistedAction: 'reload_edge_cache',
      approvalRequired: false,
      description: 'Customer-facing frontend application and fashion atelier.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#D95A1E] text-white flex items-center justify-center shadow-md">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              System Configuration & Safety Governance
            </h2>
            <p className="text-xs text-stone-500">
              RecoverOps telemetry settings, allowlisted recovery adapters, and risk-gate policies.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border flex items-center space-x-1.5 ${
              backendOnline
                ? 'bg-emerald-50 text-[#2E7D32] border-emerald-200'
                : 'bg-rose-50 text-[#D32F2F] border-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-[#2E7D32] animate-pulse' : 'bg-[#D32F2F]'
              }`}
            />
            <span>{backendOnline ? 'Backend Connected' : 'Backend Offline'}</span>
          </span>
        </div>
      </div>

      {/* API Gateway & Telemetry Configuration Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-3">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-[#D95A1E]" />
            <h3 className="text-sm font-bold text-stone-900">API Gateway & Connectivity</h3>
          </div>
          <button
            onClick={handlePing}
            disabled={isPinging}
            className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-[#E7E2D9] text-stone-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Radio className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-[#D95A1E]' : ''}`} />
            <span>{isPinging ? 'Pinging...' : 'Ping Health Endpoint'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-stone-50 p-3 rounded-xl border border-[#E7E2D9]">
            <span className="text-stone-500 block text-[11px]">API Base URL</span>
            <span className="font-bold text-stone-900 mt-1 block truncate">{apiBaseUrl}</span>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl border border-[#E7E2D9]">
            <span className="text-stone-500 block text-[11px]">Telemetry Polling</span>
            <span className="font-bold text-stone-900 mt-1 block">
              3s active / 8s idle interval
            </span>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl border border-[#E7E2D9]">
            <span className="text-stone-500 block text-[11px]">Last Health Probe Latency</span>
            <span className="font-bold text-stone-900 mt-1 block">
              {pingResult ? `${pingResult.latencyMs}ms (${pingResult.status})` : 'Connected (FastAPI)'}
            </span>
          </div>
        </div>
      </div>

      {/* Safety Governance Policies Card */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-[#F0EBE1] pb-3">
          <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
          <h3 className="text-sm font-bold text-stone-900">Enforced Safety Governance Rules</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#E7E2D9] bg-stone-50/50 space-y-2">
            <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs">
              <Lock className="w-4 h-4 text-[#D95A1E]" />
              <span>High-Risk Approval Gate</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                ENFORCED
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Operations on persistent databases (e.g. database restore) strictly require human operator sign-off before execution.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#E7E2D9] bg-stone-50/50 space-y-2">
            <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs">
              <FileCheck2 className="w-4 h-4 text-[#D95A1E]" />
              <span>Allowlisted Recovery Adapter</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                ENFORCED
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Only predefined internal adapters may be triggered. Arbitrary shell commands and unvalidated payloads are rejected.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#E7E2D9] bg-stone-50/50 space-y-2">
            <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs">
              <Zap className="w-4 h-4 text-[#D95A1E]" />
              <span>Prerequisite Health Gate</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                ENFORCED
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Downstream services cannot be recovered while upstream dependencies remain degraded or failed.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#E7E2D9] bg-stone-50/50 space-y-2">
            <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs">
              <HardDrive className="w-4 h-4 text-[#D95A1E]" />
              <span>State Fingerprint Validation</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                ENFORCED
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Pre-flight readiness tokens expire if the underlying service topology or incident status changes between assessment and execution.
            </p>
          </div>
        </div>
      </div>

      {/* Registered Service Topology Specs */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-3">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-[#D95A1E]" />
            <h3 className="text-sm font-bold text-stone-900">Registered Microservices & Playbooks</h3>
          </div>
          <span className="text-xs font-mono text-stone-500">5 Microservices Configured</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-stone-400 text-[11px] border-b border-[#EFEAE2]">
                <th className="font-semibold py-2">Service Name</th>
                <th className="font-semibold py-2">Topology Tier</th>
                <th className="font-semibold py-2">Risk Level</th>
                <th className="font-semibold py-2">Allowlisted Action</th>
                <th className="font-semibold py-2">Approval Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC]">
              {servicesConfig.map((svc) => (
                <tr key={svc.name} className="hover:bg-stone-50/70 transition">
                  <td className="py-3 font-bold text-stone-900">{svc.name}</td>
                  <td className="py-3 text-stone-600">{svc.tier}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        svc.risk === 'HIGH'
                          ? 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
                          : 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                      }`}
                    >
                      {svc.risk}
                    </span>
                  </td>
                  <td className="py-3 text-stone-800 font-semibold">{svc.allowlistedAction}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        svc.approvalRequired
                          ? 'bg-[#FFF8E1] text-[#F57F17] border border-[#FFECB3]'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {svc.approvalRequired ? 'Mandatory Sign-off' : 'Automated'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
