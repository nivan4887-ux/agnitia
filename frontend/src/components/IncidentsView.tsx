import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldAlert,
  Flame,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Incident } from '../types';
import { api } from '../services/api';

interface IncidentsViewProps {
  incidents: Incident[];
  onRefresh: () => void;
  onExecuteRecovery: (incidentId: string) => void;
  onInspectPlan: (service: string) => void;
  onError: (msg: string) => void;
  isExecuting?: boolean;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onRefresh,
  onExecuteRecovery,
  onInspectPlan,
  onError,
  isExecuting = false,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulateService, setSimulateService] = useState<string>('backend_api');

  const filteredIncidents = incidents.filter((inc) => {
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' &&
        (inc.status === 'open' ||
          inc.status === 'recovering' ||
          inc.status === 'awaiting_approval')) ||
      inc.status === filterStatus;

    const matchesSearch =
      inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.failed_service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.affected_services.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const handleSimulateOutage = async () => {
    setIsSimulating(true);
    try {
      await api.simulateFailure(simulateService);
      onRefresh();
    } catch (err: any) {
      onError(err.message || `Failed to trigger outage on ${simulateService}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const getStatusBadge = (status: Incident['status']) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] flex items-center space-x-1 font-mono">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Open</span>
          </span>
        );
      case 'recovering':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-[#FFF3E0] text-[#D95A1E] border border-[#FFE0B2] flex items-center space-x-1 animate-pulse font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Recovering</span>
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-[#FFF8E1] text-[#F57F17] border border-[#FFECB3] flex items-center space-x-1 animate-pulse font-mono">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Awaiting Approval</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] flex items-center space-x-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Resolved</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] flex items-center space-x-1 font-mono">
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-md bg-stone-100 text-stone-700 border border-stone-300 font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Outage Simulator Bar */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-[#D95A1E]" />
            <span>Incident Management</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time incident detection, dependency blast radius tracking, and recovery orchestration.
          </p>
        </div>

        {/* Trigger Outage Action Bar */}
        <div className="flex items-center space-x-2 bg-stone-50 p-2 rounded-xl border border-[#E7E2D9]">
          <span className="text-xs font-semibold text-stone-700 hidden sm:inline">Chaos Simulator:</span>
          <select
            value={simulateService}
            onChange={(e) => setSimulateService(e.target.value)}
            disabled={isSimulating}
            className="bg-white border border-[#E7E2D9] rounded-lg px-2.5 py-1.5 text-xs text-stone-800 font-mono focus:outline-none"
          >
            <option value="backend_api">backend_api (Core API)</option>
            <option value="products_api">products_api (Catalog)</option>
            <option value="database">database (High-Risk DB)</option>
            <option value="payment_service">payment_service (Payments)</option>
            <option value="website">website (Frontend UI)</option>
          </select>
          <button
            onClick={handleSimulateOutage}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            {isSimulating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Flame className="w-3.5 h-3.5" />
            )}
            <span>Inject Outage</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#EBE5DB] rounded-xl p-3 shadow-xs">
        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All Incidents', count: incidents.length },
            {
              id: 'active',
              label: 'Active Outages',
              count: incidents.filter(
                (i) =>
                  i.status === 'open' ||
                  i.status === 'recovering' ||
                  i.status === 'awaiting_approval'
              ).length,
            },
            {
              id: 'resolved',
              label: 'Resolved',
              count: incidents.filter((i) => i.status === 'resolved').length,
            },
            {
              id: 'failed',
              label: 'Failed',
              count: incidents.filter((i) => i.status === 'failed').length,
            },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterStatus(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                filterStatus === pill.id
                  ? 'bg-[#1C130D] text-white shadow-xs'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-[#E7E2D9]'
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filterStatus === pill.id
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {pill.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-stone-50 border border-[#E7E2D9] rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#D95A1E] w-52 sm:w-64"
            />
          </div>

          <button
            onClick={onRefresh}
            title="Refresh incidents"
            className="p-1.5 rounded-lg border border-[#E7E2D9] bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-white border border-[#EBE5DB] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#2E7D32] flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">No Incidents Found</h3>
          <p className="text-xs text-stone-500 max-w-sm">
            {searchQuery
              ? 'No incidents match your current search query.'
              : 'There are currently no recorded incidents matching this filter. You can inject a simulated outage above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => {
            const isExpanded = expandedId === incident.id;
            const canRecover =
              incident.status === 'open' ||
              incident.status === 'failed' ||
              incident.status === 'awaiting_approval';

            return (
              <div
                key={incident.id}
                className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4 hover:border-stone-300 transition"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F0EBE1] pb-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-sm font-bold text-stone-900 font-mono">
                        INC-{incident.id.slice(0, 8).toUpperCase()}
                      </span>
                      {getStatusBadge(incident.status)}
                    </div>
                    <p className="text-xs text-stone-500 font-mono">
                      Root Service:{' '}
                      <span className="font-bold text-stone-800">{incident.failed_service}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-stone-500 font-mono">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>{new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>

                    {incident.total_recovery_duration_seconds !== null && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#2E7D32] border border-emerald-200 font-semibold text-[11px]">
                        MTTR: {incident.total_recovery_duration_seconds.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Affected Services Blast Radius */}
                <div>
                  <span className="text-[11px] font-semibold text-stone-600 block mb-1.5">
                    Impacted Dependency Blast Radius ({incident.affected_services.length} services):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {incident.affected_services.map((svc) => (
                      <span
                        key={svc}
                        className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${
                          svc === incident.failed_service
                            ? 'bg-rose-50 text-[#D32F2F] border-rose-200 font-bold'
                            : 'bg-amber-50 text-[#E65100] border-amber-200 font-medium'
                        }`}
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Controls & Steps Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F0EBE1]">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                    className="flex items-center space-x-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 transition cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#D95A1E]" />
                    <span>
                      {incident.recovery_steps?.length || 0} Recovery Step
                      {incident.recovery_steps?.length === 1 ? '' : 's'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-stone-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                    )}
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onInspectPlan(incident.failed_service)}
                      className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      Inspect Playbook
                    </button>

                    {canRecover && (
                      <button
                        onClick={() => onExecuteRecovery(incident.id)}
                        disabled={isExecuting}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                      >
                        {isExecuting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white" />
                        )}
                        <span>Execute Recovery</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Detailed Steps Accordion */}
                {isExpanded && (
                  <div className="pt-2 border-t border-[#F0EBE1] space-y-2">
                    {incident.recovery_steps && incident.recovery_steps.length > 0 ? (
                      <div className="bg-stone-50 rounded-xl p-3.5 space-y-2 border border-[#E7E2D9] font-mono text-xs">
                        {incident.recovery_steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between border-b border-[#EFEAE2] pb-2 last:border-0 last:pb-0"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-[#D95A1E]">
                                  #{idx + 1} {step.service}
                                </span>
                                <span className="text-stone-500 text-[11px]">
                                  ({step.action || 'restore'})
                                </span>
                              </div>
                              {step.health_check && (
                                <p className="text-[#2E7D32] text-[11px]">
                                  ✓ Probe: {step.health_check.message}
                                </p>
                              )}
                              {step.reason && (
                                <p className="text-[#D32F2F] text-[11px]">
                                  ✗ {step.reason}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                step.status === 'healthy'
                                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]'
                                  : 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-stone-50 rounded-xl text-center text-xs text-stone-500 italic border border-[#E7E2D9]">
                        Recovery not started yet. Click &quot;Execute Recovery&quot; to initiate safe sequence.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

