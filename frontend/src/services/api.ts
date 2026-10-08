import {
  Approval,
  AuditEvent,
  ChaosScenario,
  ChaosStatusResponse,
  CheckoutResponse,
  DemoHealthResponse,
  DemoProduct,
  DependenciesResponse,
  Incident,
  LiveProbeResult,
  PaymentProcessResponse,
  RecoveryAssessment,
  RecoveryPlanResponse,
  ServiceHealth,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

  startRecovery: async (incidentId: string): Promise<{ incident: Incident }> => {
    return fetchJson(`${API_BASE_URL}/recovery/start/${encodeURIComponent(incidentId)}`, {
      method: 'POST',
    });
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
};
