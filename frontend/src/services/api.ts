import {
  Approval,
  AuditEvent,
  DependenciesResponse,
  Incident,
  RecoveryPlanResponse,
  ServiceHealth,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
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
    try {
      const errorJson = await res.json();
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore
    }
    throw new ApiError(errorDetail, res.status);
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
};

