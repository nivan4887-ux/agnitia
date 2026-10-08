export type ServiceHealth = 'healthy' | 'degraded' | 'failed' | 'recovering';

export type IncidentStatus =
  | 'open'
  | 'recovering'
  | 'awaiting_approval'
  | 'resolved'
  | 'failed'
  | 'aborted';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface RecoveryStep {
  service: string;
  action?: string;
  status: 'healthy' | 'failed' | 'recovering';
  reason?: string;
  health_check?: {
    passed: boolean;
    health_check_type: string;
    message: string;
  };
  timestamp: string;
}

export interface Incident {
  id: string;
  failed_service: string;
  affected_services: string[];
  status: IncidentStatus;
  created_at: string;
  recovery_started_at: string | null;
  recovery_completed_at: string | null;
  total_recovery_duration_seconds: number | null;
  recovery_order: string[];
  current_step_index: number;
  recovery_steps: RecoveryStep[];
  pending_approval_id: string | null;
  audit_log?: AuditEvent[];
}

export interface Approval {
  id: string;
  incident_id: string;
  service: string;
  action: string;
  risk_level: 'safe' | 'high_risk';
  description: string;
  status: ApprovalStatus;
  created_at: string;
  decided_at: string | null;
  decision_reason: string | null;
}

export interface AuditEvent {
  id: string;
  incident_id: string | null;
  event_type: string;
  service: string | null;
  details: Record<string, any>;
  timestamp: string;
}

export interface DependenciesResponse {
  nodes: string[];
  edges: { from: string; to: string }[];
}

export interface RecoveryPlanResponse {
  service: string;
  recovery_order: string[];
}

export type ReadinessStatus = 'READY' | 'NEEDS_APPROVAL' | 'BLOCKED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type FindingSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AssessmentFinding {
  severity: FindingSeverity;
  code: string;
  message: string;
  affected_service: string | null;
}

export interface RequiredApproval {
  service: string;
  action: string;
  risk_level: string;
  description: string;
}

export interface BlockedAction {
  service: string;
  reason: string;
}

export interface RecoveryAssessment {
  readiness_status: ReadinessStatus;
  risk_level: RiskLevel;
  target_service?: string;
  recovery_order?: string[];
  downstream_impact?: string[];
  summary: string;
  findings: AssessmentFinding[];
  required_approvals: RequiredApproval[];
  blocked_actions: BlockedAction[];
  recommended_next_step: string;
  is_stale?: boolean;
  state_fingerprint: string;
  assessed_at: string;
}

export interface DemoProduct {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  discount_percent?: number;
  category: string;
  in_stock: boolean;
  stock_count: number;
  description: string;
  image?: string;
  rating?: number;
  sizes?: string[];
  colors?: string[];
}

export interface DemoHealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  database_connected?: boolean;
  latency_ms?: number;
  error?: string;
  error_code?: string;
}

export interface LiveProbeResult {
  is_healthy: boolean;
  service: string;
  health_probe: {
    healthy: boolean;
    status_code: number;
    endpoint: string;
    error?: string;
    error_code?: string;
  };
  products_probe: {
    healthy: boolean;
    status_code: number;
    endpoint: string;
    products_returned?: number;
    error?: string;
  };
  incident?: Incident | null;
  timestamp: string;
}



