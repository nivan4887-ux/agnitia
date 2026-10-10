
import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wifi,
  Radio,
  RotateCcw,
} from 'lucide-react';
import { getApiBaseUrl, setCustomBackendUrl, getCustomBackendUrl } from '../services/api';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onEnableDemoMode?: () => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onEnableDemoMode,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = getCustomBackendUrl();
      setUrlInput(saved || getApiBaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const target = urlInput.trim().replace(/\/+$/, '');
    if (!target) return;

    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const res = await fetch(`${target}/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        setTestResult({
          success: true,
          message: `Successfully connected to BRIDGE API (${res.status} OK)`,
          latencyMs: latency,
        });
      } else {
        setTestResult({
          success: false,
          message: `Server responded with HTTP ${res.status}: ${res.statusText}`,
          latencyMs: latency,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message || 'Network Error / Mixed Content Blocked'}. Make sure your backend allows CORS or use HTTPS tunnel.`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = urlInput.trim().replace(/\/+$/, '');
    setCustomBackendUrl(trimmed || null);
    onSaved();
    onClose();
  };

  const handleResetDefault = () => {
    setCustomBackendUrl(null);
    setUrlInput('http://localhost:8000');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backend-config-title"
      >
        {/* Header */}
        <div className="bg-[#1C130D] text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 id="backend-config-title" className="text-base font-bold text-white tracking-tight">
                Backend Connection Settings
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Connect your deployed frontend to a live FastAPI engine or cloud tunnel.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
              FastAPI Server URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder="e.g. http://localhost:8000 or https://xyz.ngrok-free.app"
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 font-mono text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !urlInput.trim()}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isTesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Radio className="w-3.5 h-3.5 text-orange-400" />
                )}
                <span>Test</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-semibold text-stone-500">Quick Presets:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  setUrlInput('http://localhost:8000');
                  setTestResult(null);
                }}
                className="px-2 py-1 text-[11px] font-mono bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md border border-stone-300/80 transition"
              >
                http://localhost:8000
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlInput('http://172.10.22.210:8000');
                  setTestResult(null);
                }}
                className="px-2 py-1 text-[11px] font-mono bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md border border-stone-300/80 transition"
              >
                http://172.10.22.210:8000 (LAN)
              </button>
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{testResult.message}</p>
                {testResult.latencyMs !== undefined && (
                  <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
                    Roundtrip Latency: {testResult.latencyMs}ms
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notice about Vercel HTTPS & Mixed Content */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
            <p className="font-bold flex items-center space-x-1">
              <Wifi className="w-3.5 h-3.5 text-amber-700" />
              <span>Browser Mixed Content Warning:</span>
            </p>
            <p className="text-amber-800 leading-relaxed">
              When viewing on <strong>https://*.vercel.app</strong>, modern browsers block unencrypted <code>http://</code> requests to remote IPs. For cloud testing, use an HTTPS tunnel (e.g. <code>ngrok http 8000</code> or Cloudflare Tunnel) or test locally on <code>http://localhost:5173</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
          {onEnableDemoMode ? (
            <button
              type="button"
              onClick={() => {
                onEnableDemoMode();
                onClose();
              }}
              className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-200/60 rounded-lg transition cursor-pointer"
            >
              Enable Standalone Demo Mode
            </button>
          ) : <div />}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-xs transition cursor-pointer active:scale-95"
            >
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
