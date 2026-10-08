import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Approval,
  AuditEvent,
  DependenciesResponse,
  Incident,
  RecoveryPlanResponse,
  RecoveryAssessment,
  ServiceHealth,
} from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { DependencyGraph } from './components/DependencyGraph';
import { CurrentIncidentCard } from './components/CurrentIncidentCard';
import { PrerequisiteChecksCard } from './components/PrerequisiteChecksCard';
import { ApprovalCenter } from './components/ApprovalCenter';
import { AuditTimeline } from './components/AuditTimeline';
import { RecentIncidentsTable } from './components/RecentIncidentsTable';
import { RecentRecoveryActionsTable } from './components/RecentRecoveryActionsTable';
import { RecoveryPlanModal } from './components/RecoveryPlanModal';
import { DemoStoreView } from './components/DemoStoreView';
import { IncidentsView } from './components/IncidentsView';
import { RecoveryEngineView } from './components/RecoveryEngineView';
import { DependencyGraphView } from './components/DependencyGraphView';
import { AuditLogView } from './components/AuditLogView';
import { SettingsView } from './components/SettingsView';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation State
  const [activeNav, setActiveNav] = useState<string>('overview');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'demo_store'>('dashboard');

  // Backend state
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
  const [assessment, setAssessment] = useState<RecoveryAssessment | null>(null);

  // UI state
  const [selectedService, setSelectedService] = useState<string>('backend_api');
  const [previewPlan, setPreviewPlan] = useState<RecoveryPlanResponse | null>(null);
  const [isExecutingRecovery, setIsExecutingRecovery] = useState<boolean>(false);

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

      // Run assessment for the target service or incident
      const openInc = incidentsRes.incidents.find(
        (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
      );

      try {
        const assessRes = await api.assessRecovery({
          service: openInc ? undefined : (selectedService || 'backend_api'),
          incident_id: openInc?.id,
        });
        if (isMountedRef.current) setAssessment(assessRes);
      } catch (e) {
        // quiet fallback
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setBackendOnline(false);
      if (!isSilent) {
        setErrorMessage(
          `Unable to connect to RecoverOps backend (${err.message || 'Network Error'}). Make sure FastAPI server is running on port 8000.`
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

  // Dynamic Polling
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

  const handleStartRecovery = async (incidentId: string) => {
    setIsExecutingRecovery(true);
    try {
      // Find matching incident
      const inc = incidents.find((i) => i.id === incidentId) || incidents[0];
      if (inc) {
        await api.startRecovery(inc.id);
      } else {
        // If no incident in backend, simulate failure then start
        await api.simulateFailure('backend_api');
        const res = await api.getIncidents();
        if (res.incidents.length > 0) {
          await api.startRecovery(res.incidents[0].id);
        }
      }
      showSuccess('Recovery sequence successfully executed through allowlisted adapter!');
      fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to start recovery sequence');
    } finally {
      setIsExecutingRecovery(false);
    }
  };

  const handlePreviewPlan = async (service: string) => {
    try {
      const plan = await api.getRecoveryPlan(service);
      setPreviewPlan(plan);
    } catch (err: any) {
      showError(err.message || `Failed to fetch recovery plan for ${service}`);
    }
  };

  const handleSimulateOutage = async (service: string) => {
    try {
      await api.simulateFailure(service);
      showSuccess(`Simulated outage injected on ${service}`);
      fetchData();
    } catch (err: any) {
      showError(err.message || `Failed to simulate failure on ${service}`);
    }
  };

  const activeIncidents = incidents.filter(
    (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
  );

  const currentIncident = activeIncidents.length > 0 ? activeIncidents[0] : incidents[0] || null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation Bar with brand identity, nav tabs, mode switchers, & telemetry */}
      <Header
        activeNav={activeNav}
        onSelectNav={(nav) => {
          setActiveNav(nav);
          setActiveTab('dashboard');
        }}
        activeIncidentsCount={activeIncidents.length}
        backendOnline={backendOnline}
        isPolling={isPolling}
        lastUpdated={lastUpdated}
        onRefresh={() => fetchData()}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Alerts Banner Container */}
        {errorMessage && (
          <div className="mb-5 bg-rose-50 border border-rose-300 rounded-xl p-3.5 flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <p className="text-xs font-medium text-rose-800">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 p-1 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-medium text-emerald-800">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-800 p-1 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body Workspace */}
        <main className="flex-1 space-y-5">
          {activeTab === 'demo_store' ? (
            <DemoStoreView
              onIncidentCreated={() => {
                fetchData();
                showSuccess('Real HTTP 503 outage detected! Incident created in RecoverOps.');
              }}
              onNavigateToDashboard={() => {
                setActiveTab('dashboard');
                setActiveNav('overview');
              }}
              onError={showError}
            />
          ) : activeNav === 'incidents' ? (
            <IncidentsView
              incidents={incidents}
              onRefresh={() => fetchData()}
              onExecuteRecovery={handleStartRecovery}
              onInspectPlan={handlePreviewPlan}
              onError={showError}
              isExecuting={isExecutingRecovery}
            />
          ) : activeNav === 'engine' ? (
            <RecoveryEngineView
              services={services}
              incidents={incidents}
              pendingApprovals={pendingApprovals}
              selectedService={selectedService}
              onSelectService={(s) => setSelectedService(s)}
              onExecuteRecovery={handleStartRecovery}
              onInspectPlan={handlePreviewPlan}
              onRefresh={() => fetchData()}
              onError={showError}
              isExecuting={isExecutingRecovery}
            />
          ) : activeNav === 'graph' ? (
            <DependencyGraphView
              dependencies={dependencies}
              services={services}
              selectedService={selectedService}
              onSelectService={(s) => setSelectedService(s)}
              onInspectPlan={handlePreviewPlan}
              onSimulateFailure={handleSimulateOutage}
            />
          ) : activeNav === 'audit' ? (
            <AuditLogView
              auditEvents={auditEvents}
              onRefresh={() => fetchData()}
            />
          ) : activeNav === 'settings' ? (
            <SettingsView
              backendOnline={backendOnline}
              onRefresh={() => fetchData()}
              onError={showError}
            />
          ) : (
            /* Default: Overview View */
            <>
              {/* Top Row: 5 Stat Overview Cards */}
              <OverviewCards
                services={services}
                incidents={incidents}
                pendingApprovalsCount={pendingApprovals.length}
              />

              {/* Main Operations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column (~58% width on large screens) */}
                <div className="lg:col-span-7 space-y-5">
                  <DependencyGraph
                    dependencies={dependencies}
                    services={services}
                    selectedService={selectedService}
                    onSelectService={(s) => setSelectedService(s)}
                  />

                  <RecentIncidentsTable
                    incidents={incidents}
                    onSelectIncident={(inc) => {
                      setSelectedService(inc.failed_service);
                      handlePreviewPlan(inc.failed_service);
                    }}
                    onViewAll={() => setActiveNav('incidents')}
                  />

                  <RecentRecoveryActionsTable
                    auditEvents={auditEvents}
                    onViewAll={() => setActiveNav('audit')}
                  />
                </div>

                {/* Right Column (~42% width on large screens) */}
                <div className="lg:col-span-5 space-y-5">
                  <CurrentIncidentCard
                    incident={currentIncident}
                    assessment={assessment}
                    onExecuteRecovery={handleStartRecovery}
                    onViewDetails={() => handlePreviewPlan(selectedService || 'backend_api')}
                    isExecuting={isExecutingRecovery}
                  />

                  <PrerequisiteChecksCard assessment={assessment} />

                  <ApprovalCenter
                    approvals={pendingApprovals}
                    onActionComplete={() => {
                      showSuccess('Approval recorded.');
                      fetchData();
                    }}
                    onError={showError}
                  />

                  <AuditTimeline
                    auditEvents={auditEvents}
                    onViewAll={() => setActiveNav('audit')}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Recovery Plan Modal */}
      <RecoveryPlanModal
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
};

export default App;
