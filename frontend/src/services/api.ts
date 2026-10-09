import type {
  Approval,
  AuditEvent,
  ChaosScenario,
  ChaosStatusResponse,
  CheckoutResponse,
  DemoHealthResponse,
  DemoProduct,
  DependenciesResponse,
  ChangeSet,
  Incident,
  LiveProbeResult,
  PaymentProcessResponse,
  RecoveryAssessment,
  RecoveryPlanResponse,
  RecoveryStartResponse,
  RecoveryJobResponse,
  RecoveryStatusResponse,
  ServiceHealth,
  SOSRequest,
  SOSResponse,
} from '../types';

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8000`;
    }
  }
  return envUrl || 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

// --- BRIDGE Database & Catalog API Resilient Retry Interceptor ---
export const DB_RECOVERY_RETRY_POLICY = {
  maxRetries: 3,
  baseBackoffMs: 250,
  retryableStatusCodes: [502, 503, 504],
  circuitBreakerThreshold: 5,
};
// ------------------------------------------------------------------

class ApiError extends Error {
  status: number;
  errorCode?: string;
  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    let errorCode: string | undefined = undefined;
    try {
      const errorJson = await res.json();
      if (errorJson.detail) {
        if (typeof errorJson.detail === 'string') {
          errorDetail = errorJson.detail;
        } else if (typeof errorJson.detail === 'object') {
          errorDetail = errorJson.detail.error || errorJson.detail.reason || JSON.stringify(errorJson.detail);
          errorCode = errorJson.detail.error_code;
        }
      } else if (errorJson.error) {
        errorDetail = errorJson.error;
        errorCode = errorJson.error_code;
      }
    } catch {
      // ignore
    }
    throw new ApiError(errorDetail, res.status, errorCode);
  }

  return res.json();
}

export const api = {
  getHealth: async (): Promise<{ status: string; service: string }> => {
    return fetchJson(`${API_BASE_URL}/`);
  },

  getServices: async (): Promise<{ services: Record<string, ServiceHealth> }> => {
    return fetchJson(`${API_BASE_URL}/services`);
  },

  getDependencies: async (): Promise<DependenciesResponse> => {
    return fetchJson(`${API_BASE_URL}/dependencies`);
  },

  simulateFailure: async (serviceName: string): Promise<{ incident: Incident }> => {
    return fetchJson(`${API_BASE_URL}/simulate/fail/${encodeURIComponent(serviceName)}`, {
      method: 'POST',
    });
  },

  getIncidents: async (): Promise<{ incidents: Incident[] }> => {
    return fetchJson(`${API_BASE_URL}/incidents`);
  },

  getIncidentById: async (incidentId: string): Promise<{ incident: Incident }> => {
    return fetchJson(`${API_BASE_URL}/incidents/${encodeURIComponent(incidentId)}`);
  },

  getRecoveryPlan: async (serviceName: string): Promise<RecoveryPlanResponse> => {
    return fetchJson(`${API_BASE_URL}/recovery/plan/${encodeURIComponent(serviceName)}`);
  },

  startRecovery: async (incidentId: string): Promise<RecoveryStartResponse> => {
    return fetchJson(`${API_BASE_URL}/recovery/start/${encodeURIComponent(incidentId)}`, {
      method: 'POST',
    });
  },

  proposeIncidentRepair: async (
    incidentId: string
  ): Promise<{ incident: Incident; changeset: ChangeSet }> => {
    return fetchJson(`${API_BASE_URL}/recovery/propose-repair/${encodeURIComponent(incidentId)}`, {
      method: 'POST',
    });
  },

  getRecoveryJob: async (jobId: string): Promise<RecoveryJobResponse> => {
    return fetchJson(`${API_BASE_URL}/recovery/jobs/${encodeURIComponent(jobId)}`);
  },

  getRecoveryStatus: async (incidentId: string): Promise<RecoveryStatusResponse> => {
    return fetchJson(`${API_BASE_URL}/recovery/status/${encodeURIComponent(incidentId)}`);
  },

  getApprovals: async (status?: string): Promise<{ approvals: Approval[] }> => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson(`${API_BASE_URL}/approvals${query}`);
  },

  getPendingApprovals: async (): Promise<{ pending_approvals: Approval[] }> => {
    return fetchJson(`${API_BASE_URL}/approvals/pending`);
  },

  approveAction: async (
    approvalId: string,
    reason?: string
  ): Promise<{ approval: Approval; incident: Incident }> => {
    return fetchJson(`${API_BASE_URL}/approvals/${encodeURIComponent(approvalId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null }),
    });
  },

  rejectAction: async (
    approvalId: string,
    reason?: string
  ): Promise<{ approval: Approval; incident: Incident }> => {
    return fetchJson(`${API_BASE_URL}/approvals/${encodeURIComponent(approvalId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null }),
    });
  },

  getAuditLogs: async (incidentId?: string): Promise<{ audit_log: AuditEvent[] }> => {
    const query = incidentId ? `?incident_id=${encodeURIComponent(incidentId)}` : '';
    return fetchJson(`${API_BASE_URL}/audit${query}`);
  },

  configureSimulation: async (payload: {
    service: string;
    action_success?: boolean;
    health_check_success?: boolean;
    risk_level?: string;
    action_error?: string;
    health_check_error?: string;
  }): Promise<{ status: string; service: string }> => {
    return fetchJson(`${API_BASE_URL}/simulate/configure`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  assessRecovery: async (params: {
    service?: string;
    incident_id?: string;
    expected_state_fingerprint?: string;
  }): Promise<RecoveryAssessment> => {
    return fetchJson(`${API_BASE_URL}/recovery/assess`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Demo Mini-Store & Live Probe APIs
  getDemoProducts: async (params?: {
    category?: string;
    search?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ status: string; products: DemoProduct[]; item_count: number; total_available: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== 'All') searchParams.append('category', params.category);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchJson(`${API_BASE_URL}/demo/products${qs}`);
  },

  getProductById: async (productId: string): Promise<{ status: string; product: DemoProduct }> => {
    return fetchJson(`${API_BASE_URL}/demo/products/${encodeURIComponent(productId)}`);
  },

  getDemoHealth: async (): Promise<DemoHealthResponse> => {
    return fetchJson(`${API_BASE_URL}/demo/health`);
  },

  injectDemoChaos: async (reason?: string): Promise<{ status: string; service: string; reason: string }> => {
    return fetchJson(`${API_BASE_URL}/demo/chaos/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null }),
    });
  },

  restoreDemoService: async (): Promise<{ status: string; service: string; message: string }> => {
    return fetchJson(`${API_BASE_URL}/demo/chaos/restore`, {
      method: 'POST',
    });
  },

  runLiveProbe: async (autoCreateIncident: boolean = true): Promise<LiveProbeResult> => {
    return fetchJson(`${API_BASE_URL}/live/probe?auto_create_incident=${autoCreateIncident}`, {
      method: 'POST',
    });
  },

  // Multi-Scenario Chaos API
  getChaosScenarios: async (): Promise<{
    status: string;
    scenarios: ChaosScenario[];
    active_scenario: ChaosScenario | null;
  }> => {
    return fetchJson(`${API_BASE_URL}/demo/scenarios`);
  },

  injectChaosScenario: async (scenarioId: string): Promise<{
    status: string;
    scenario: ChaosScenario;
    message: string;
  }> => {
    return fetchJson(`${API_BASE_URL}/demo/chaos/inject`, {
      method: 'POST',
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
  },

  getChaosStatus: async (): Promise<ChaosStatusResponse> => {
    return fetchJson(`${API_BASE_URL}/demo/chaos/status`);
  },

  resetChaos: async (): Promise<{ status: string; message: string }> => {
    return fetchJson(`${API_BASE_URL}/demo/chaos/reset`, {
      method: 'POST',
    });
  },

  checkInventory: async (productId: string): Promise<{
    status: string;
    product_id: string;
    in_stock: boolean;
    stock_count: number;
  }> => {
    return fetchJson(`${API_BASE_URL}/demo/inventory/${encodeURIComponent(productId)}`);
  },

  submitCheckout: async (payload: {
    items: any[];
    shipping_address: any;
    payment_method: string;
    coupon_code?: string;
    subtotal: number;
    total: number;
  }): Promise<CheckoutResponse> => {
    return fetchJson(`${API_BASE_URL}/demo/checkout`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  processPayment: async (payload: {
    order_id: string;
    amount: number;
    payment_method: string;
  }): Promise<PaymentProcessResponse> => {
    return fetchJson(`${API_BASE_URL}/demo/payment/process`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Standalone OS Process Management APIs
  getStandaloneStatus: async (port?: number): Promise<{
    supervisor: {
      running: boolean;
      pid: number | null;
      control_backend_pid: number;
      port: number;
      entrypoint: string;
      started_at: string | null;
      exit_code: number | null;
      log_history_count: number;
      recent_logs: string[];
    };
    health_probe: any;
    products_probe: any;
    is_healthy: boolean;
  }> => {
    const query = port ? `?port=${port}` : '';
    return fetchJson(`${API_BASE_URL}/standalone/status${query}`);
  },

  startStandaloneProcess: async (port?: number): Promise<any> => {
    const query = port ? `?port=${port}` : '';
    return fetchJson(`${API_BASE_URL}/standalone/start${query}`, { method: 'POST' });
  },

  stopStandaloneProcess: async (): Promise<any> => {
    return fetchJson(`${API_BASE_URL}/standalone/stop`, { method: 'POST' });
  },

  failStandaloneProcess: async (port?: number): Promise<any> => {
    const query = port ? `?port=${port}` : '';
    return fetchJson(`${API_BASE_URL}/standalone/fail${query}`, { method: 'POST' });
  },

  probeStandaloneService: async (autoCreateIncident: boolean = true, port?: number): Promise<any> => {
    const params = new URLSearchParams();
    params.append('auto_create_incident', String(autoCreateIncident));
    if (port) params.append('port', String(port));
    return fetchJson(`${API_BASE_URL}/standalone/probe?${params.toString()}`, { method: 'POST' });
  },

  // Codex-Style Code Changes & Review APIs
  listCodeChanges: async (incidentId?: string): Promise<{ changesets: ChangeSet[] }> => {
    const query = incidentId ? `?incident_id=${encodeURIComponent(incidentId)}` : '';
    return fetchJson(`${API_BASE_URL}/code-changes${query}`);
  },

  getCodeChangeSet: async (changesetId: string): Promise<{ changeset: ChangeSet }> => {
    return fetchJson(`${API_BASE_URL}/code-changes/${encodeURIComponent(changesetId)}`);
  },

  proposeCodeChangeSet: async (payload: {
    title: string;
    description: string;
    file_patches: Record<string, string>;
    service?: string;
    incident_id?: string;
  }): Promise<{ changeset: ChangeSet }> => {
    return fetchJson(`${API_BASE_URL}/code-changes/propose`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  reviewFile: async (
    changesetId: string,
    filePath: string,
    decision: 'accepted' | 'rejected' | 'pending'
  ): Promise<{ changeset: ChangeSet }> => {
    return fetchJson(`${API_BASE_URL}/code-changes/${encodeURIComponent(changesetId)}/file-review`, {
      method: 'POST',
      body: JSON.stringify({ file_path: filePath, decision }),
    });
  },

  acceptAllFiles: async (changesetId: string): Promise<{ changeset: ChangeSet }> => {
    return fetchJson(`${API_BASE_URL}/code-changes/${encodeURIComponent(changesetId)}/accept-all`, {
      method: 'POST',
    });
  },

  rejectAllFiles: async (changesetId: string): Promise<{ changeset: ChangeSet }> => {
    return fetchJson(`${API_BASE_URL}/code-changes/${encodeURIComponent(changesetId)}/reject-all`, {
      method: 'POST',
    });
  },

  applyChangeSet: async (
    changesetId: string
  ): Promise<{ status: string; changeset: ChangeSet; validation_results: any }> => {
    return fetchJson(`${API_BASE_URL}/code-changes/${encodeURIComponent(changesetId)}/apply`, {
      method: 'POST',
    });
  },

  // Emergency SOS Incident Trigger API
  triggerSOS: async (payload: SOSRequest): Promise<SOSResponse> => {
    return fetchJson(`${API_BASE_URL}/incidents/sos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};


