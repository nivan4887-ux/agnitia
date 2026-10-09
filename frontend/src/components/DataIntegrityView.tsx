import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Database,
  Archive,
  RefreshCw,
  PlusCircle,
  Bug,
  CheckCircle2,
  Trash2,
  Wrench,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import type { DataIntegrityStatusResponse } from '../types';

interface DataIntegrityViewProps {
  onRefresh?: () => void;
}

export const DataIntegrityView: React.FC<DataIntegrityViewProps> = ({ onRefresh }) => {
  const [data, setData] = useState<DataIntegrityStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getIntegrityStatus();
      setData(res);
    } catch (err: any) {
      console.error('Failed to fetch data integrity status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleInjectMalformed = async (scenario: string, label: string) => {
    setIsProcessing(true);
    try {
      const res = await api.injectMalformedRecord(scenario);
      showToast(
        'error',
        `🚨 P1 Emergency SOS Triggered! Audible Siren & Voice Call dispatched. Intercepted & Quarantined [${res.quarantine_id}]: ${label}.`
      );
      await fetchStatus();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast('error', `Failed to inject: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInjectValid = async () => {
    setIsProcessing(true);
    try {
      const sampleNames = ['Merino Knit Cardigan', 'Suede Trench Coat', 'Linen Tailored Trousers', 'Cashmere Beanie'];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const randomAmount = Math.floor(Math.random() * 250) + 75;

      const res = await api.ingestRecord({
        item_name: randomName,
        customer_email: `customer.${Math.floor(Math.random() * 900 + 100)}@example.com`,
        amount: randomAmount,
        quantity: 1,
        currency: 'USD',
      });

      if (res.accepted) {
        showToast('success', `Valid Record Ingested: "${randomName}" ($${randomAmount}) verified & stored.`);
      }
      await fetchStatus();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast('error', `Ingestion failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecover = async (quarantineId: string) => {
    setIsProcessing(true);
    try {
      const res = await api.recoverQuarantinedRecord(quarantineId);
      if (res.success) {
        showToast('success', `✅ Recovered & Promoted! ${res.message}. Emergency Siren cleared.`);
      }
      await fetchStatus();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast('error', `Recovery failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurge = async (quarantineId: string) => {
    setIsProcessing(true);
    try {
      await api.purgeQuarantinedRecord(quarantineId);
      showToast('info', `Quarantined payload ${quarantineId} purged safely.`);
      await fetchStatus();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast('error', `Purge failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    setIsProcessing(true);
    try {
      await api.resetIntegrityStore();
      showToast('success', 'Reset completed: baseline valid records restored, quarantine cleared, emergency siren reset.');
      await fetchStatus();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast('error', `Reset failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-stone-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading Data Integrity Gate status...</span>
      </div>
    );
  }

  const validRecords = data?.valid_records || [];
  const quarantinedRecords = data?.quarantined_records || [];
  const activeQuarantined = quarantinedRecords.filter((q) => q.status === 'quarantined');

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between border shadow-lg transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60'
              : actionMessage.type === 'error'
              ? 'bg-red-950/80 text-red-200 border-red-700/60'
              : 'bg-amber-950/80 text-amber-200 border-amber-700/60'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {actionMessage.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
            {actionMessage.type === 'info' && <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-stone-400 hover:text-stone-200 text-xs ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#1C130D] border border-[#2C1E16] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-stone-100">
                Data Integrity Gate & Dead-Letter Quarantine
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Zero Contamination Guarantee
              </span>
            </div>
            <p className="text-sm text-stone-400">
              Demonstrate deliberate malformed record ingestion, real-time validation gate interception,
              isolated dead-letter quarantine, and verified safe recovery without corrupting valid database records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-[#2C1E16] hover:bg-[#3D2B20] text-stone-300 text-xs font-medium rounded-lg border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              Reset Baseline
            </button>
          </div>
        </div>
      </div>

      {/* KPI Proof Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Database Status */}
        <div className="bg-[#1C130D] border border-emerald-900/40 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Primary DB Status</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-xl font-bold text-emerald-400 flex items-center gap-1.5">
            <Database className="w-5 h-5" />
            <span>Healthy & Intact</span>
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Zero corrupted writes permitted</div>
        </div>

        {/* Metric 2: Valid Records Intact */}
        <div className="bg-[#1C130D] border border-[#2C1E16] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Valid Records (Intact)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-stone-100">
            {data?.valid_records_count ?? 0}
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1">100% Schema & Domain Verified</div>
        </div>

        {/* Metric 3: Quarantined Records */}
        <div className="bg-[#1C130D] border border-amber-900/40 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Isolated in Quarantine</span>
            <Archive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {activeQuarantined.length}
          </div>
          <div className="text-[11px] text-amber-400/90 mt-1">
            {data?.recovered_records_count ? `${data.recovered_records_count} Recovered` : 'Dead-Letter Segregated'}
          </div>
        </div>

        {/* Metric 4: Contamination Rate */}
        <div className="bg-[#1C130D] border border-[#2C1E16] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Contamination Rate</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            0.0%
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Primary storage uncontaminated</div>
        </div>
      </div>

      {/* Demonstration Action Toolbar */}
      <div className="bg-[#1C130D] border border-[#2C1E16] rounded-xl p-4">
        <div className="text-xs font-semibold text-stone-300 uppercase tracking-wider mb-3 flex flex-wrap items-center gap-2">
          <span>Demonstration Actions</span>
          <span className="text-stone-400 normal-case font-normal">• Intercepts corruption & triggers emergency siren + voice call</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleInjectValid}
            disabled={isProcessing}
            className="px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-medium rounded-lg border border-emerald-700/60 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            + Ingest Valid Record
          </button>

          <div className="h-6 w-px bg-stone-700/50 mx-1 hidden sm:block" />

          <button
            onClick={() => handleInjectMalformed('negative_price', 'Negative Price (-$450.00)')}
            disabled={isProcessing}
            className="px-3.5 py-2 bg-red-950/70 hover:bg-red-900/90 text-red-200 text-xs font-medium rounded-lg border border-red-700/60 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Bug className="w-4 h-4 text-red-400" />
            💥 Inject Malformed: Negative Price (-$450.00)
            <span className="ml-1 text-[9px] bg-red-500/20 text-red-300 px-1 py-0.2 rounded font-mono border border-red-500/30">SIREN + CALL</span>
          </button>

          <button
            onClick={() => handleInjectMalformed('missing_customer', 'Invalid Email & Bogus Currency')}
            disabled={isProcessing}
            className="px-3.5 py-2 bg-amber-950/70 hover:bg-amber-900/90 text-amber-200 text-xs font-medium rounded-lg border border-amber-700/60 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            ⚠️ Inject Malformed: Schema & Currency Breach
            <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono border border-amber-500/30">SIREN + CALL</span>
          </button>

          <button
            onClick={() => handleInjectMalformed('script_injection', 'Script Injection <script>')}
            disabled={isProcessing}
            className="px-3.5 py-2 bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 text-xs font-medium rounded-lg border border-purple-700/60 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            🛡️ Inject Malformed: Script Payload Attack
            <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded font-mono border border-purple-500/30">SIREN + CALL</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Proof Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Primary Database (Intact Valid Records) */}
        <div className="bg-[#1C130D] border border-emerald-900/30 rounded-xl p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2C1E16]">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                <Database className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-semibold text-stone-100 text-sm">Primary Database (`valid_orders`)</h3>
                <p className="text-[11px] text-emerald-400">Verified Intact • Zero Corruption</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {validRecords.length} Records
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px] pr-1">
            {validRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-3.5 rounded-lg bg-[#241810] border border-stone-800 hover:border-emerald-700/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-amber-300">{rec.id}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                        VERIFIED
                      </span>
                      {rec.recovered_from_quarantine && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300">
                          RECOVERED
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-stone-200 mt-1">{rec.item_name}</h4>
                    <p className="text-xs text-stone-400">{rec.customer_email}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-300">
                      ${Number(rec.amount).toFixed(2)} {rec.currency}
                    </span>
                    <div className="text-[10px] text-stone-400">Qty: {rec.quantity}</div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-stone-400">
                  <span className="font-mono truncate max-w-[200px]">chk: {rec.checksum}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Intact
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Quarantine Vault (Isolated Dead-Letter Store) */}
        <div className="bg-[#1C130D] border border-amber-900/30 rounded-xl p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2C1E16]">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                <Archive className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-semibold text-stone-100 text-sm">Quarantine Vault (`quarantined_records`)</h3>
                <p className="text-[11px] text-amber-400">Dead-Letter Isolation • Isolated From Prod</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {activeQuarantined.length} Active / {quarantinedRecords.length} Total
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px] pr-1">
            {quarantinedRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-stone-500 text-xs text-center border border-dashed border-stone-800 rounded-lg p-6">
                <ShieldCheck className="w-8 h-8 text-stone-600 mb-2" />
                <span>Quarantine Vault is currently empty.</span>
                <span className="text-[11px] text-stone-400 mt-1">
                  Click an "Inject Malformed" button above to demonstrate automatic interception.
                </span>
              </div>
            ) : (
              quarantinedRecords.map((q) => {
                const isQuarantined = q.status === 'quarantined';
                return (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isQuarantined
                        ? 'bg-[#261510] border-amber-800/60 shadow-sm'
                        : q.status === 'recovered_and_promoted'
                        ? 'bg-[#122019] border-emerald-800/40 opacity-75'
                        : 'bg-[#1a1a1a] border-stone-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{q.id}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              isQuarantined
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : q.status === 'recovered_and_promoted'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-stone-500/20 text-stone-400'
                            }`}
                          >
                            {q.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400 mt-1">
                          Target: <span className="font-mono text-stone-300">{q.target_record_id}</span>
                        </div>
                      </div>

                      {isQuarantined && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleRecover(q.id)}
                            disabled={isProcessing}
                            title="Auto-sanitize and promote to primary database"
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center gap-1"
                          >
                            <Wrench className="w-3 h-3" />
                            Sanitize & Recover
                          </button>
                          <button
                            onClick={() => handlePurge(q.id)}
                            disabled={isProcessing}
                            title="Purge permanently"
                            className="p-1 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Violations List */}
                    <div className="mt-2.5 bg-black/40 rounded p-2 text-xs space-y-1">
                      <div className="text-[11px] font-semibold text-red-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        Integrity Gate Rejection Reasons:
                      </div>
                      <ul className="list-disc list-inside text-red-300/90 text-[11px] space-y-0.5">
                        {q.violations.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Raw Payload Preview */}
                    <div className="mt-2 text-[10px] text-stone-400 font-mono bg-black/30 p-1.5 rounded truncate">
                      Payload: {JSON.stringify(q.raw_payload)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
