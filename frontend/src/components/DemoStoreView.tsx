import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Server,
  Activity,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Tag,
  Package,
} from 'lucide-react';
import { DemoProduct, DemoHealthResponse, LiveProbeResult } from '../types';
import { api } from '../services/api';

interface DemoStoreViewProps {
  onIncidentCreated?: () => void;
  onNavigateToDashboard?: () => void;
  onError: (msg: string) => void;
}

export const DemoStoreView: React.FC<DemoStoreViewProps> = ({
  onIncidentCreated,
  onNavigateToDashboard,
  onError,
}) => {
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [health, setHealth] = useState<DemoHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [lastProbe, setLastProbe] = useState<LiveProbeResult | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);

  const fetchStoreData = async () => {
    setIsLoading(true);
    try {
      const [hRes] = await Promise.all([
        api.getDemoHealth(),
      ]);
      setHealth(hRes);

      if (hRes.status === 'healthy') {
        const pRes = await api.getDemoProducts();
        setProducts(pRes.products);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      setHealth({
        status: 'unhealthy',
        service: 'backend_api_products',
        error: err.message || 'HTTP 503 Service Unavailable',
        error_code: 'ERR_DB_POOL_EXHAUSTED',
      });
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
    const timer = setInterval(() => {
      fetchStoreData();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleInjectFailure = async () => {
    setIsInjecting(true);
    try {
      await api.injectDemoChaos('Simulated database connection pool exhaustion on Products API');
      // Run live probe immediately to auto-create incident in RecoverOps
      const probeRes = await api.runLiveProbe(true);
      setLastProbe(probeRes);
      if (onIncidentCreated) onIncidentCreated();
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Failed to inject chaos failure');
    } finally {
      setIsInjecting(false);
    }
  };

  const handleManualProbe = async () => {
    setIsProbing(true);
    try {
      const probeRes = await api.runLiveProbe(true);
      setLastProbe(probeRes);
      if (probeRes.incident && onIncidentCreated) {
        onIncidentCreated();
      }
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Health probe failed');
    } finally {
      setIsProbing(false);
    }
  };

  const handleBuy = (productName: string) => {
    setCartCount((c) => c + 1);
    setBuySuccess(`Added "${productName}" to cart!`);
    setTimeout(() => setBuySuccess(null), 3000);
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="space-y-6">
      {/* Live Demo Store Control & Status Header */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl text-white shadow-md">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  RecoverOps Mini-Store
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Live Demo Target
                </span>
              </div>
              <p className="text-xs text-slate-400">
                A genuine local HTTP storefront backed by the <code className="text-cyan-300 font-mono">backend_api</code> Products API
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isHealthy ? (
              <button
                onClick={handleInjectFailure}
                disabled={isInjecting}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center space-x-2 transition disabled:opacity-50"
              >
                <Flame className="w-4 h-4 text-white animate-bounce" />
                <span>{isInjecting ? 'Tripping API...' : 'Inject Live Outage (HTTP 503)'}</span>
              </button>
            ) : (
              <button
                onClick={onNavigateToDashboard}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center space-x-2 transition"
              >
                <Zap className="w-4 h-4" />
                <span>Switch to Control Plane & Recover</span>
              </button>
            )}

            <button
              onClick={handleManualProbe}
              disabled={isProbing}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              <span>{isProbing ? 'Probing...' : 'Run Real HTTP Probe'}</span>
            </button>
          </div>
        </div>

        {/* Live HTTP Status Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              isHealthy
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-200 animate-pulse'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {isHealthy ? 'HTTP 200 OK' : 'HTTP 503 Service Unavailable'}
              </p>
              <p className="text-[11px] opacity-90 font-mono">
                {isHealthy ? 'Endpoint /demo/health responding' : 'Endpoint /demo/health returning 503'}
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2 font-mono">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Service Target:</span>
            </div>
            <span className="font-mono font-bold text-white">backend_api (Products API)</span>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2 font-mono">
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
              <span>Shopping Cart:</span>
            </div>
            <span className="font-mono font-bold text-white">{cartCount} items</span>
          </div>
        </div>
      </div>

      {/* Cart Notification Toast */}
      {buySuccess && (
        <div className="bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{buySuccess}</span>
        </div>
      )}

      {/* Products Catalog Display or Real HTTP 503 Outage Notice */}
      {isLoading && products.length === 0 && isHealthy ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-xs font-mono">Fetching catalog from live Products API (/demo/products)...</p>
        </div>
      ) : !isHealthy ? (
        <div className="bg-gradient-to-b from-rose-950/60 to-[#0f172a] border border-rose-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-rose-900/60 border border-rose-700 text-rose-300 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-9 h-9 text-rose-400 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-white font-mono">
              [HTTP 503] Products API Connection Failed
            </h3>
            <p className="text-xs text-rose-200">
              {health?.error || 'Database connection pool exhausted. The live storefront cannot fetch catalog data.'}
            </p>
            {health?.error_code && (
              <p className="text-[11px] font-mono text-rose-400">
                Error Code: <strong>{health.error_code}</strong>
              </p>
            )}
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 max-w-lg mx-auto text-left font-mono text-xs text-slate-300 space-y-1.5 shadow-inner">
            <div className="text-slate-400 text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>Actual Diagnostic Response</span>
              <span className="text-rose-400 font-bold">503 Service Unavailable</span>
            </div>
            <p className="text-rose-300">GET /demo/products &rarr; 503</p>
            <p className="text-slate-400 text-[11px]">Reason: {health?.error}</p>
            <p className="text-cyan-400 text-[11px] pt-1">
              &bull; Incident registered in RecoverOps SRE Control Plane.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateToDashboard}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg inline-flex items-center space-x-2 transition"
            >
              <span>Inspect & Execute Recovery in Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-[#0f172a] border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3 transition hover:shadow-md group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-cyan-300 border border-slate-700 flex items-center space-x-1">
                    <Tag className="w-2.5 h-2.5" />
                    <span>{p.category}</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                    <Package className="w-2.5 h-2.5" />
                    <span>{p.stock_count} in stock</span>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {p.name}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-2">{p.description}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-sm font-extrabold text-white font-mono">
                  ${p.price.toFixed(2)}
                </span>
                <button
                  onClick={() => handleBuy(p.name)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white text-xs font-medium rounded-lg border border-slate-700 hover:border-cyan-500 transition shadow-sm flex items-center space-x-1"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Add to Cart</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Probe Diagnostic Terminal Output */}
      {lastProbe && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800 text-[11px]">
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-white">Live HTTP Probe Telemetry</span>
            </div>
            <span>{new Date(lastProbe.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Health Endpoint: </span>
              <span className={lastProbe.health_probe.healthy ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {lastProbe.health_probe.endpoint} &rarr; HTTP {lastProbe.health_probe.status_code}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Catalog Endpoint: </span>
              <span className={lastProbe.products_probe.healthy ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {lastProbe.products_probe.endpoint} &rarr; HTTP {lastProbe.products_probe.status_code}
              </span>
            </div>
          </div>
          {lastProbe.incident && (
            <div className="p-2 bg-rose-950/60 border border-rose-800 rounded text-rose-300 text-[11px]">
              &bull; <strong>Auto-Detected Real Incident:</strong> Incident #{lastProbe.incident.id.slice(0, 8)} created for target <code className="text-white">{lastProbe.incident.failed_service}</code>.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
