import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Approval,
  AuditEvent,
  DependenciesResponse,
  Incident,
  RecoveryPlanResponse,
  ServiceHealth,
} from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { DependencyGraph } from './components/DependencyGraph';
import { SimulationPanel } from './components/SimulationPanel';
import { IncidentPanel } from './components/IncidentPanel';
import { ApprovalCenter } from './components/ApprovalCenter';
import { AuditTimeline } from './components/AuditTimeline';
import { RecoveryPlanModal } from './components/RecoveryPlanModal';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  // State
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Core data
  const [services, setServices] = useState<Record<string, ServiceHealth>>({});
  const [dependencies, setDependencies] = useState<DependenciesResponse>({
    nodes: [],
    edges: [],
  });
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // UI state
  const [selectedService, setSelectedService] = useState<string>('database');
  const [previewPlan, setPreviewPlan] = useState<RecoveryPlanResponse | null>(null);

  const isMountedRef = useRef(true);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      if (isMountedRef.current) setSuccessMessage(null);
    }, 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => {
      if (isMountedRef.current) setErrorMessage(null);
    }, 5000);
  };

  // Main data fetch function
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsPolling(true);
    try {
      const [
        healthRes,
        servicesRes,
        depsRes,
        incidentsRes,
        approvalsRes,
        auditRes,
      ] = await Promise.all([
        api.getHealth(),
        api.getServices(),
        api.getDependencies(),
        api.getIncidents(),
        api.getPendingApprovals(),
        api.getAuditLogs(),
      ]);

      if (!isMountedRef.current) return;

      setBackendOnline(healthRes.status === 'ok');
      setServices(servicesRes.services);
      setDependencies(depsRes);
      setIncidents(incidentsRes.incidents);
      setPendingApprovals(approvalsRes.pending_approvals);
      setAuditEvents(auditRes.audit_log);
      setLastUpdated(new Date());
      setErrorMessage(null);

      if (depsRes.nodes.length > 0 && !selectedService) {
        setSelectedService(depsRes.nodes[0]);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setBackendOnline(false);
      if (!isSilent) {
        setErrorMessage(
          `Unable to connect to RecoverOps backend (${err.message || 'Network Error'}). Make sure FastAPI server is running.`
        );
      }
    } finally {
      if (isMountedRef.current) setIsPolling(false);
    }
  }, [selectedService]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  // Dynamic Polling: 3s if active incidents or pending approvals, 8s otherwise
  useEffect(() => {
    const hasActiveIncidents = incidents.some(
      (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
    );
    const intervalMs = hasActiveIncidents || pendingApprovals.length > 0 ? 3000 : 8000;

    const timer = setInterval(() => {
      fetchData(true);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [fetchData, incidents, pendingApprovals]);

  const handlePreviewPlan = async (service: string) => {
    try {
      const plan = await api.getRecoveryPlan(service);
      setPreviewPlan(plan);
    } catch (err: any) {
      showError(err.message || `Failed to fetch recovery plan for ${service}`);
    }
  };

  const handleFailSuccess = () => {
    showSuccess(`Failure simulated on '${selectedService}'. Downstream dependents degraded.`);
    fetchData();
  };

  const handleRecoveryStarted = () => {
    showSuccess('Recovery sequence started.');
    fetchData();
  };

  const handleActionComplete = () => {
    showSuccess('Approval decision recorded. Recovery status updated.');
    fetchData();
  };

  const activeIncidentsCount = incidents.filter(
    (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
  ).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <Header
        backendOnline={backendOnline}
        isPolling={isPolling}
        lastUpdated={lastUpdated}
        onRefresh={() => fetchData()}
        activeIncidentsCount={activeIncidentsCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error / Alert banner */}
        {errorMessage && (
          <div className="bg-rose-950/80 border border-rose-800 rounded-xl p-4 flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <p className="text-sm font-medium text-rose-200">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-1"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success toast banner */}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-200">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 p-1"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Overview KPI Cards */}
        <OverviewCards
          services={services}
          incidents={incidents}
          pendingApprovalsCount={pendingApprovals.length}
        />

        {/* Pending Approvals Callout (when active) */}
        {pendingApprovals.length > 0 && (
          <ApprovalCenter
            approvals={pendingApprovals}
            onActionComplete={handleActionComplete}
            onError={showError}
          />
        )}

        {/* Center Grid: Dependency Graph & Side Control */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DependencyGraph
              dependencies={dependencies}
              services={services}
              selectedService={selectedService}
              onSelectService={(s) => setSelectedService(s)}
            />
          </div>

          <div className="space-y-6">
            <SimulationPanel
              services={dependencies.nodes}
              selectedService={selectedService}
              onSelectService={setSelectedService}
              onFailSuccess={handleFailSuccess}
              onPreviewPlan={handlePreviewPlan}
              onError={showError}
            />
          </div>
        </div>

        {/* Lower Grid: Incident Orchestration & Audit Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncidentPanel
            incidents={incidents}
            onRecoveryStarted={handleRecoveryStarted}
            onError={showError}
          />

          <AuditTimeline auditEvents={auditEvents} />
        </div>
      </main>

      {/* Recovery Plan Modal */}
      <RecoveryPlanModal
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#0f172a]/40 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        RecoverOps • 24h Hackathon Project • Safe Dependency-Aware Incident Recovery Platform
      </footer>
    </div>
  );
};

export default App;

