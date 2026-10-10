import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Approval,
  AuditEvent,
  ChangeSet,
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
import { CodeChangeReviewModal } from './components/CodeChangeReviewModal';
import { SOSTriggerModal } from './components/SOSTriggerModal';
import { FaultInjectionModal } from './components/FaultInjectionModal';
import { EmergencyAlarmBanner } from './components/EmergencyAlarmBanner';
import { DataIntegrityView } from './components/DataIntegrityView';
import { BackendConfigModal } from './components/BackendConfigModal';
import { AlertTriangle, XCircle, CheckCircle2, AlertOctagon, Flame, ExternalLink } from 'lucide-react';

const DEFAULT_BASELINE_SERVICES: Record<string, ServiceHealth> = {
  database: 'healthy',
  backend_api: 'healthy',
  order_service: 'healthy',
  payment_service: 'healthy',
  website: 'healthy',
};

const DEFAULT_BASELINE_DEPS: DependenciesResponse = {
  nodes: ['database', 'backend_api', 'order_service', 'payment_service', 'website'],
  edges: [
    { from: 'database', to: 'backend_api' },
    { from: 'backend_api', to: 'order_service' },
    { from: 'backend_api', to: 'payment_service' },
    { from: 'order_service', to: 'website' },
    { from: 'payment_service', to: 'website' },
  ],
};

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

  // Core data (initialized with baseline topology to prevent UI collapse when offline)
  const [services, setServices] = useState<Record<string, ServiceHealth>>(DEFAULT_BASELINE_SERVICES);
  const [dependencies, setDependencies] = useState<DependenciesResponse>(DEFAULT_BASELINE_DEPS);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [assessment, setAssessment] = useState<RecoveryAssessment | null>(null);

  // UI state
  const [selectedService, setSelectedService] = useState<string>('backend_api');
  const [previewPlan, setPreviewPlan] = useState<RecoveryPlanResponse | null>(null);
  const [reviewChangeSet, setReviewChangeSet] = useState<ChangeSet | null>(null);
  const [isExecutingRecovery, setIsExecutingRecovery] = useState<boolean>(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState<boolean>(false);
  const [isFaultModalOpen, setIsFaultModalOpen] = useState<boolean>(false);
  const [isBackendConfigOpen, setIsBackendConfigOpen] = useState<boolean>(false);

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
      // Retain baseline topology so dashboard does not collapse into an empty state
      setServices((prev) => (Object.keys(prev).length > 0 ? prev : DEFAULT_BASELINE_SERVICES));
      setDependencies((prev) => (prev.nodes.length > 0 ? prev : DEFAULT_BASELINE_DEPS));
      if (!isSilent) {
        setErrorMessage(
          `Unable to connect to BRIDGE backend (${err.message || 'Network Error'}). Make sure FastAPI server is running on port 8000 or configure the backend URL.`
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
      if (!incidentId) {
        throw new Error('No active incident selected for recovery.');
      }
      // Launch 12-15s AI Coding Agent Review & Recovery Orchestration
      const res = await api.proposeIncidentRepair(incidentId);
      setReviewChangeSet(res.changeset);
    } catch (err: any) {
      showError(err.message || 'Failed to initialize AI recovery orchestrator');
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

  const handleReviewCodePatch = async (incidentId: string) => {
    try {
      const res = await api.proposeIncidentRepair(incidentId);
      setReviewChangeSet(res.changeset);
    } catch (err: any) {
      showError(err.message || 'Failed to generate code repair changeset');
    }
  };

  const activeIncidents = incidents.filter(
    (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
  );

  const currentIncident = activeIncidents.length > 0 ? activeIncidents[0] : null;

  const isStandaloneStore = typeof window !== 'undefined' && (
    window.location.port === '5174' ||
    new URLSearchParams(window.location.search).get('view') === 'store' ||
    window.location.pathname.startsWith('/store')
  );

  // Standalone Store Mode (For Port 5174 / Customer Persona Laptop 1)
  if (isStandaloneStore) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Top Sync & Persona Strip */}
        <div className="bg-[#140E0A] text-stone-300 border-b border-[#2C1E16] sticky top-0 z-50 px-4 sm:px-6 py-2.5 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shadow-xs">
                <img src="/logo.png" alt="BRIDGE Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-black font-mono tracking-wider text-white">BRIDGE ATELIER</span>
                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase bg-[#EA580C] text-white rounded">
                    Storefront (Port 5174)
                  </span>
                  <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live SRE Remote Sync</span>
                  </span>
                </div>
                <p className="text-[10px] text-stone-400">Independent Customer Device Persona (Laptop 1)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsFaultModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                title="Trigger simulated production failure to alert Laptop 2"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Simulate Outage</span>
              </button>

              <a
                href={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5173`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#261710] hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white text-xs font-semibold transition"
              >
                <span>SRE Platform (5173)</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {errorMessage && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setIsBackendConfigOpen(true)}
                  className="px-2.5 py-1 rounded-md bg-stone-900 hover:bg-stone-800 text-white font-semibold text-[11px] transition cursor-pointer"
                >
                  Configure Backend URL
                </button>
                <button onClick={() => setErrorMessage(null)} className="p-1 cursor-pointer">
                  <XCircle className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="p-1 cursor-pointer">
                <XCircle className="w-4 h-4 text-emerald-500" />
              </button>
            </div>
          </div>
        )}

        {/* Full E-Commerce Storefront */}
        <div className="flex-1">
          <DemoStoreView
            onIncidentCreated={() => {
              fetchData();
              showSuccess('Outage injected! Alert and siren notification broadcast to Laptop 2.');
            }}
            onNavigateToDashboard={() => {
              window.open(`http://${window.location.hostname}:5173`, '_blank');
            }}
            onError={showError}
          />
        </div>

        {/* Fault Injection Modal */}
        <FaultInjectionModal
          isOpen={isFaultModalOpen}
          onClose={() => setIsFaultModalOpen(false)}
          onIncidentCreated={(newIncident) => {
            fetchData();
            showSuccess(
              `Outage '${newIncident.id}' created for ${newIncident.failed_service}! Siren alert triggered on Laptop 2.`
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
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
        onOpenSOS={() => setIsSosModalOpen(true)}
        onOpenInjectFault={() => setIsFaultModalOpen(true)}
        onOpenBackendConfig={() => setIsBackendConfigOpen(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Real-Time Emergency Alarm Siren Banner */}
        <EmergencyAlarmBanner
          activeIncidents={activeIncidents}
          onViewIncident={(inc) => {
            setActiveTab('dashboard');
            setActiveNav('engine');
            setSelectedService(inc.failed_service);
            handlePreviewPlan(inc.failed_service);
          }}
        />

        {/* Alerts Banner Container */}
        {errorMessage && (
          <div className="mb-5 bg-rose-50 border border-rose-300 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <p className="text-xs font-medium text-rose-800">{errorMessage}</p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setIsBackendConfigOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition cursor-pointer"
              >
                ⚙️ Configure Backend URL
              </button>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-800 p-1 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
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
                showSuccess('Real HTTP 503 outage detected! Incident created in BRIDGE.');
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
          ) : activeNav === 'integrity' ? (
            <DataIntegrityView onRefresh={() => fetchData()} />
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
                    onReviewCodePatch={handleReviewCodePatch}
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

      {/* Code Change Review Modal */}
      <CodeChangeReviewModal
        changeSet={reviewChangeSet}
        onUpdateChangeSet={(updated) => setReviewChangeSet(updated)}
        onApplied={async (appliedCs) => {
          setReviewChangeSet(null);
          setActiveTab('dashboard');
          setActiveNav('overview');
          showSuccess(`Change set ${appliedCs.id} applied. Executing live health verification probes...`);
          try {
            if (appliedCs.incident_id) {
              const res = await api.startRecovery(appliedCs.incident_id);
              if (res.incident.status === 'awaiting_approval') {
                showSuccess('Recovery initiated: High-risk action paused awaiting operator approval.');
              } else if (res.incident.status === 'resolved') {
                showSuccess('Recovery sequence verified and completed successfully across all health probes.');
              } else if (res.incident.status === 'failed') {
                const lastStep = res.incident.recovery_steps?.[res.incident.recovery_steps.length - 1];
                showError(`Recovery failed: ${lastStep?.reason || 'Health verification failed'}`);
              }
            }
            await fetchData();
          } catch (e: any) {
            showError(e.message || 'Recovery verification error');
          } finally {
            setIsExecutingRecovery(false);
          }
        }}
        onClose={() => {
          setReviewChangeSet(null);
          setIsExecutingRecovery(false);
        }}
      />

      {/* Emergency SOS Trigger Modal (Mobile-first responsive drawer/modal) */}
      <SOSTriggerModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        availableServices={
          dependencies.nodes.length > 0
            ? dependencies.nodes
            : [
                'backend_api',
                'database',
                'order_service',
                'payment_service',
                'website',
              ]
        }
        initialService={selectedService || 'backend_api'}
        onIncidentCreated={(newIncident) => {
          fetchData();
          showSuccess(
            `P1 Emergency SOS incident '${newIncident.id}' successfully registered for service '${newIncident.failed_service}'.`
          );
        }}
      />

      {/* Chaos & Fault Injection Suite Modal */}
      <FaultInjectionModal
        isOpen={isFaultModalOpen}
        onClose={() => setIsFaultModalOpen(false)}
        onIncidentCreated={(newIncident) => {
          fetchData();
          showSuccess(
            `Fault injected: Incident '${newIncident.id}' successfully registered for '${newIncident.failed_service}'.`
          );
        }}
      />

      {/* Backend Connection & Latency Config Modal */}
      <BackendConfigModal
        isOpen={isBackendConfigOpen}
        onClose={() => setIsBackendConfigOpen(false)}
        onSaved={() => {
          fetchData();
          showSuccess('Backend connection URL updated! Re-testing telemetry...');
        }}
        onEnableDemoMode={() => {
          setBackendOnline(true);
          setServices(DEFAULT_BASELINE_SERVICES);
          setDependencies(DEFAULT_BASELINE_DEPS);
          showSuccess('Interactive Standalone Demo Mode active.');
        }}
      />

      {/* Mobile Floating Action Button for Instant SOS Access */}
      <div className="lg:hidden fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsSosModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-full shadow-2xl border-2 border-white/30 transition-all font-black text-xs uppercase tracking-wider cursor-pointer"
          aria-label="Emergency SOS Outage Trigger"
        >
          <AlertOctagon className="w-4 h-4 animate-pulse text-white" />
          <span>SOS ALERT</span>
        </button>
      </div>
    </div>
  );
};

export default App;

