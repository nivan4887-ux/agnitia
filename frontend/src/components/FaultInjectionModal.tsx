import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Database,
  Flame,
  Globe,
  Loader2,
  PackageCheck,
  Server,
  ShieldAlert,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { Incident } from '../types';

export interface FaultOption {
  id: string;
  fault_type: string;
  service: string;
  title: string;
  category: string;
  description: string;
  severity: 'P1' | 'P2';
  expectedDurationSec: number;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
}

export const FAULT_OPTIONS: FaultOption[] = [
  {
    id: 'api_500_fault',
    fault_type: 'api_500_fault',
    service: 'backend_api',
    title: 'API 500 Internal Fault Spike',
    category: 'API & Gateway',
    description:
      'NullReference exception in /api/v1/checkout checkout processing handler. Injects 500 error flood across API clients.',
    severity: 'P1',
    expectedDurationSec: 15,
    icon: Zap,
    accentColor: 'text-amber-500 border-amber-500/40 bg-amber-500/10',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    id: 'gateway_timeout',
    fault_type: 'gateway_timeout',
    service: 'backend_api',
    title: '504 Gateway Timeout Cascade',
    category: 'Network & SLA',
    description:
      'Downstream microservice response time exceeding 8000ms SLA. Triggers circuit breaker trip and connection backlog.',
    severity: 'P1',
    expectedDurationSec: 18,
    icon: WifiOff,
    accentColor: 'text-orange-500 border-orange-500/40 bg-orange-500/10',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    id: 'order_backpressure',
    fault_type: 'order_backpressure',
    service: 'order_service',
    title: 'Order Queue Deadlock & Backpressure',
    category: 'Event Pipeline',
    description:
      'RabbitMQ consumer pipeline locked with 4,200+ unacknowledged order jobs. Worker thread starvation occurs.',
    severity: 'P2',
    expectedDurationSec: 20,
    icon: PackageCheck,
    accentColor: 'text-indigo-500 border-indigo-500/40 bg-indigo-500/10',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    id: 'payment_timeout',
    fault_type: 'payment_timeout',
    service: 'payment_service',
    title: 'Payment Settlement Timeout',
    category: 'Financial Flow',
    description:
      'Upstream payment settlement gateway times out during capture. Webhook reconciliation backlog and dropped sales.',
    severity: 'P1',
    expectedDurationSec: 22,
    icon: Server,
    accentColor: 'text-rose-500 border-rose-500/40 bg-rose-500/10',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    id: 'frontend_syntax_crash',
    fault_type: 'frontend_syntax_crash',
    service: 'website',
    title: 'Frontend Vite Bundler AST Crash',
    category: 'UI & Build System',
    description:
      'Syntax error token in React web app bundle halts Vite HMR compiler and delivers white-screen crash to end users.',
    severity: 'P2',
    expectedDurationSec: 25,
    icon: Globe,
    accentColor: 'text-sky-500 border-sky-500/40 bg-sky-500/10',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    id: 'database_deadlock',
    fault_type: 'database_deadlock',
    service: 'database',
    title: 'DB Connection Pool Exhaustion',
    category: 'Database Cluster',
    description:
      '100/100 active connections locked with mutual table lock deadlock on orders table. Rejects all read/write queries.',
    severity: 'P1',
    expectedDurationSec: 28,
    icon: Database,
    accentColor: 'text-red-500 border-red-500/40 bg-red-500/10',
    badgeBg: 'bg-red-100 text-red-800 border-red-200',
  },
  {
    id: 'data_corruption',
    fault_type: 'data_corruption',
    service: 'database',
    title: 'Data Integrity Quarantine Event',
    category: 'Data Governance',
    description:
      'Ingestion of corrupted order record with negative pricing & XSS script tag. Intercepted by quarantine gate.',
    severity: 'P1',
    expectedDurationSec: 28,
    icon: ShieldAlert,
    accentColor: 'text-fuchsia-500 border-fuchsia-500/40 bg-fuchsia-500/10',
    badgeBg: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  },
];

interface FaultInjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentCreated: (incident: Incident) => void;
}

export const FaultInjectionModal: React.FC<FaultInjectionModalProps> = ({
  isOpen,
  onClose,
  onIncidentCreated,
}) => {
  const [selectedFault, setSelectedFault] = useState<FaultOption>(FAULT_OPTIONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInject = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const response = await api.injectFault({
        fault_type: selectedFault.fault_type,
        service: selectedFault.service,
        reason: customReason.trim() || undefined,
      });

      if (response && response.incident) {
        setSuccessInfo(
          `Fault injected: Incident ${response.incident.id} created for ${response.incident.failed_service}`
        );
        onIncidentCreated(response.incident);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        throw new Error(response?.message || 'Failed to inject fault');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while injecting fault');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in fade-in slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fault-modal-title"
      >
        {/* Header */}
        <div className="bg-[#1C130D] text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 id="fault-modal-title" className="text-base sm:text-lg font-bold font-mono tracking-tight text-white">
                  Chaos & Fault Injection Suite
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Adaptive Recovery
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Simulate diverse production failures with dynamic resolution durations (min 15s) and contextual code patches.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
              <AlertOctagon className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Fault Category Selection Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
              Select Failure Type ({FAULT_OPTIONS.length} Available Scenarios)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FAULT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedFault.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedFault(opt)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#EA580C] bg-orange-50/70 shadow-xs ring-1 ring-[#EA580C]'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${opt.badgeBg}`}>
                          {opt.severity} • {opt.category}
                        </span>
                        <div className="flex items-center space-x-1 text-[11px] font-mono text-stone-500 font-semibold">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>~{opt.expectedDurationSec}s</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className={`p-1.5 rounded-lg border ${opt.accentColor} shrink-0`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-stone-900 leading-tight">
                          {opt.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1.5 line-clamp-2">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] font-mono text-stone-500">
                      <span>Target: <strong className="text-stone-700">{opt.service}</strong></span>
                      {isSelected && (
                        <span className="text-[#EA580C] font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Details Preview Box */}
          <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Simulation Dynamics: {selectedFault.title}</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-stone-200/80 text-stone-700">
                Resolution Duration: {selectedFault.expectedDurationSec}.0s (Min 15s)
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              When triggered, BRIDGE will log telemetry spikes, trigger visual indicators, and allow one-click adaptive code repair via a multi-file unified diff. Solving this fault will execute progressive verification for exactly <strong>{selectedFault.expectedDurationSec} seconds</strong>.
            </p>
          </div>

          {/* Optional Custom Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Custom Scenario Notes / Reason (Optional)
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={`e.g. Chaos drill for ${selectedFault.title}`}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#EA580C] text-stone-900 bg-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-200/60 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInject}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-xs flex items-center space-x-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Injecting Outage...</span>
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 text-white" />
                <span>Inject Fault ({selectedFault.expectedDurationSec}s Repair)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
