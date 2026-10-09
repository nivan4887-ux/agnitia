import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Flame,
  Info,
  Loader2,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Incident, SOSResponse } from '../types';

interface SOSTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableServices: string[];
  initialService?: string;
  onIncidentCreated: (incident: Incident) => void;
}

export const SOSTriggerModal: React.FC<SOSTriggerModalProps> = ({
  isOpen,
  onClose,
  availableServices,
  initialService = 'backend_api',
  onIncidentCreated,
}) => {
  const [selectedService, setSelectedService] = useState<string>(initialService);
  const [reason, setReason] = useState<string>('Critical production service failure reported via mobile SOS');
  const [reporter, setReporter] = useState<string>('oncall_operator');
  const [confirmedSafety, setConfirmedSafety] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sosResult, setSosResult] = useState<SOSResponse | null>(null);

  // Sync initial service when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedService(initialService || availableServices[0] || 'backend_api');
      setConfirmedSafety(false);
      setIsSubmitting(false);
      setError(null);
      setSosResult(null);
    }
  }, [isOpen, initialService, availableServices]);

  if (!isOpen) return null;

  const handleTriggerSOS = async () => {
    if (!confirmedSafety || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    // Generate unique idempotency key for this submission attempt
    const idempotencyKey = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const response = await api.triggerSOS({
        service: selectedService,
        reason: reason.trim() || 'Manual emergency SOS trigger',
        reporter: reporter.trim() || 'mobile_operator',
        idempotency_key: idempotencyKey,
      });

      setSosResult(response);
      onIncidentCreated(response.incident);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch SOS alert. Please verify backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setConfirmedSafety(false);
    setError(null);
    setSosResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Modal Card – Bottom sheet on mobile, centered card on desktop */}
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in fade-in slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-modal-title"
      >
        {/* Emergency Header */}
        <div className="bg-[#1C130D] text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white font-mono">
                  P1 CRITICAL
                </span>
                <span className="text-stone-400 text-xs font-mono">EMERGENCY PROTOCOL</span>
              </div>
              <h2 id="sos-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                Emergency SOS Incident Trigger
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
            aria-label="Close SOS Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-stone-800">
          {/* SUCCESS STATE */}
          {sosResult ? (
            <div className="space-y-5 py-2 animate-in fade-in">
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <h3 className="font-bold text-emerald-900 text-sm">
                    {sosResult.duplicate ? 'Duplicate SOS Request Re-Confirmed' : 'Emergency Incident Dispatched'}
                  </h3>
                  <p className="text-emerald-700 mt-1">
                    {sosResult.message}
                  </p>
                </div>
              </div>

              {/* Incident Details Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <span className="text-xs font-medium text-stone-500">Incident Identifier</span>
                  <span className="font-mono font-bold text-xs bg-white px-2.5 py-1 rounded border border-stone-300 text-stone-900">
                    {sosResult.incident_id}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <span className="text-xs font-medium text-stone-500">Current Incident Status</span>
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-rose-100 text-rose-800 border border-rose-300 uppercase">
                    {sosResult.current_status}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <span className="text-xs font-medium text-stone-500">Failed Service Target</span>
                  <span className="font-mono font-bold text-xs text-stone-900">
                    {sosResult.service}
                  </span>
                </div>

                {sosResult.incident.affected_services?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-stone-500 block mb-1.5">
                      Cascaded Degraded Dependencies ({sosResult.incident.affected_services.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sosResult.incident.affected_services.map((svc) => (
                        <span
                          key={svc}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                            svc === sosResult.service
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Safety notice: not auto-resolved */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-800">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="font-semibold">Safety Control Invariant:</strong> The incident is in <strong>OPEN</strong> status. High-risk automated recovery actions are safely held behind dependency and approval gates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#D95A1E] hover:bg-[#C24E17] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm transition active:scale-98 cursor-pointer"
                >
                  <span>Inspect in Control Plane</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* CONFIGURATION & CONFIRMATION STEP */
            <div className="space-y-4">
              {/* ERROR ALERT (IF ANY) */}
              {error && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-rose-800 animate-in fade-in">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-rose-900">SOS Trigger Failed</p>
                    <p className="mt-0.5">{error}</p>
                    <button
                      onClick={handleReset}
                      className="mt-2 text-rose-700 underline font-semibold cursor-pointer hover:text-rose-900"
                    >
                      Dismiss & Edit Parameters
                    </button>
                  </div>
                </div>
              )}

              {/* Impact Notice */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-stone-700">
                <Info className="w-4 h-4 text-[#D95A1E] shrink-0 mt-0.5" />
                <p>
                  Triggering an SOS immediately flags the target service as <strong>FAILED</strong>, cascades degradation across all upstream/downstream dependents, and generates an auditable incident in MongoDB.
                </p>
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Target Failed Service
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-11 px-3 text-sm font-mono font-medium rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D95A1E] transition disabled:opacity-50"
                >
                  {availableServices.map((svc) => (
                    <option key={svc} value={svc}>
                      {svc} {svc === 'backend_api' ? '(Primary API)' : svc === 'database' ? '(Tier-0 Core)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason / Incident Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Emergency Diagnosis / Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                  placeholder="e.g. Critical 503 response latency spike detected by on-call engineer"
                  className="w-full p-3 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D95A1E] transition resize-none disabled:opacity-50"
                />
              </div>

              {/* Reporter Tag */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Dispatching Operator
                </label>
                <input
                  type="text"
                  value={reporter}
                  onChange={(e) => setReporter(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. oncall_operator_mobile"
                  className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D95A1E] transition disabled:opacity-50"
                />
              </div>

              {/* Confirmation Step (Mandatory) */}
              <div className="pt-2">
                <label
                  className={`flex items-start space-x-3 p-3.5 rounded-xl border transition cursor-pointer select-none ${
                    confirmedSafety
                      ? 'bg-rose-50/70 border-rose-300 text-rose-950 shadow-xs'
                      : 'bg-stone-50 border-stone-300 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={confirmedSafety}
                    onChange={(e) => setConfirmedSafety(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold block">
                      Confirm Outage Trigger Authorization
                    </span>
                    <span className="text-[11px] text-stone-500 mt-0.5 block leading-relaxed">
                      I confirm this is an active production outage requiring immediate SRE triage and simulated dependency recovery.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleTriggerSOS}
                  disabled={!confirmedSafety || isSubmitting}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm transition active:scale-98 cursor-pointer ${
                    confirmedSafety && !isSubmitting
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                      : 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Dispatching Emergency SOS Alert...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4 text-white" />
                      <span>Dispatch SOS Incident Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
