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
      <div className="bg-white border border-[#E7E2D9] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0EBE1] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-600 rounded-xl text-white shadow-sm">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-[#1C130D] tracking-tight">
                  RecoverOps Mini-Store
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-brand-50 text-brand-800 border border-brand-200">
                  Live Demo Target
                </span>
              </div>
              <p className="text-xs text-stone-500">
                A genuine local HTTP storefront backed by the <code className="text-brand-700 font-mono font-semibold">backend_api</code> Products API
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isHealthy ? (
              <button
                onClick={handleInjectFailure}
                disabled={isInjecting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-2 transition disabled:opacity-50"
              >
                <Flame className="w-4 h-4 text-rose-100 animate-pulse" />
                <span>{isInjecting ? 'Tripping API...' : 'Inject Live Outage (HTTP 503)'}</span>
              </button>
            ) : (
              <button
                onClick={onNavigateToDashboard}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-2 transition"
              >
                <Zap className="w-4 h-4" />
                <span>Switch to Control Plane & Recover</span>
              </button>
            )}

            <button
              onClick={handleManualProbe}
              disabled={isProbing}
              className="px-3.5 py-2 bg-white hover:bg-stone-50 text-[#1C130D] text-xs font-medium rounded-lg border border-[#E7E2D9] flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-brand-600' : 'text-stone-400'}`} />
              <span>{isProbing ? 'Probing...' : 'Run Real HTTP Probe'}</span>
            </button>
          </div>
        </div>

        {/* Live HTTP Status Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              isHealthy
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider font-mono">
                {isHealthy ? 'HTTP 200 OK' : 'HTTP 503 Service Unavailable'}
              </p>
              <p className="text-[11px] opacity-90 font-mono">
                {isHealthy ? 'Endpoint /demo/health responding' : 'Endpoint /demo/health returning 503'}
              </p>
            </div>
          </div>

          <div className="p-3 bg-stone-50 border border-[#E7E2D9] rounded-xl flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center space-x-2 font-mono">
              <Server className="w-4 h-4 text-brand-600" />
              <span>Service Target:</span>
            </div>
            <span className="font-mono font-bold text-[#1C130D]">backend_api (Products API)</span>
          </div>

          <div className="p-3 bg-stone-50 border border-[#E7E2D9] rounded-xl flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center space-x-2 font-mono">
              <ShoppingBag className="w-4 h-4 text-brand-600" />
              <span>Shopping Cart:</span>
            </div>
            <span className="font-mono font-bold text-[#1C130D]">{cartCount} items</span>
          </div>
        </div>
      </div>

      {/* Cart Notification Toast */}
      {buySuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{buySuccess}</span>
        </div>
      )}

      {/* Products Catalog Display or Real HTTP 503 Outage Notice */}
      {isLoading && products.length === 0 && isHealthy ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-mono">Fetching catalog from live Products API (/demo/products)...</p>
        </div>
      ) : !isHealthy ? (
        <div className="bg-rose-50/50 border border-rose-300 rounded-2xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-9 h-9 text-rose-600 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-rose-950 font-mono">
              [HTTP 503] Products API Connection Failed
            </h3>
            <p className="text-xs text-rose-800">
              {health?.error || 'Database connection pool exhausted. The live storefront cannot fetch catalog data.'}
            </p>
            {health?.error_code && (
              <p className="text-[11px] font-mono text-rose-700">
                Error Code: <strong>{health.error_code}</strong>
              </p>
            )}
          </div>

          <div className="bg-white border border-rose-200 rounded-xl p-4 max-w-lg mx-auto text-left font-mono text-xs text-stone-800 space-y-1.5 shadow-sm">
            <div className="text-stone-500 text-[11px] pb-1 border-b border-stone-200 flex items-center justify-between">
              <span>Actual Diagnostic Response</span>
              <span className="text-rose-600 font-bold">503 Service Unavailable</span>
            </div>
            <p className="text-rose-700 font-semibold">GET /demo/products &rarr; 503</p>
            <p className="text-stone-600 text-[11px]">Reason: {health?.error}</p>
            <p className="text-brand-700 text-[11px] pt-1 font-medium">
              &bull; Incident registered in RecoverOps SRE Control Plane.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateToDashboard}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center space-x-2 transition"
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
              className="bg-white border border-[#E7E2D9] hover:border-brand-300 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3 transition hover:shadow-md group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-100 text-stone-700 border border-stone-200 flex items-center space-x-1">
                    <Tag className="w-2.5 h-2.5" />
                    <span>{p.category}</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono flex items-center space-x-1 font-medium">
                    <Package className="w-2.5 h-2.5" />
                    <span>{p.stock_count} in stock</span>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#1C130D] group-hover:text-brand-700 transition-colors">
                  {p.name}
                </h4>
                <p className="text-xs text-stone-500 line-clamp-2">{p.description}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#F0EBE1]">
                <span className="text-sm font-extrabold text-[#1C130D] font-mono">
                  ${p.price.toFixed(2)}
                </span>
                <button
                  onClick={() => handleBuy(p.name)}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-brand-600 text-[#1C130D] hover:text-white text-xs font-medium rounded-lg border border-[#E7E2D9] hover:border-brand-600 transition shadow-xs flex items-center space-x-1"
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
        <div className="bg-stone-50 border border-[#E7E2D9] rounded-xl p-4 font-mono text-xs text-stone-700 space-y-2">
          <div className="flex items-center justify-between text-stone-500 pb-1 border-b border-[#E7E2D9] text-[11px]">
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-brand-600" />
              <span className="font-semibold text-[#1C130D]">Live HTTP Probe Telemetry</span>
            </div>
            <span>{new Date(lastProbe.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-stone-500">Health Endpoint: </span>
              <span className={lastProbe.health_probe.healthy ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                {lastProbe.health_probe.endpoint} &rarr; HTTP {lastProbe.health_probe.status_code}
              </span>
            </div>
            <div>
              <span className="text-stone-500">Catalog Endpoint: </span>
              <span className={lastProbe.products_probe.healthy ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                {lastProbe.products_probe.endpoint} &rarr; HTTP {lastProbe.products_probe.status_code}
              </span>
            </div>
          </div>
          {lastProbe.incident && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
              &bull; <strong>Auto-Detected Real Incident:</strong> Incident #{lastProbe.incident.id.slice(0, 8)} created for target <code className="text-rose-950 font-bold">{lastProbe.incident.failed_service}</code>.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
