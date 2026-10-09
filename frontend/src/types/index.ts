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

export interface ChaosScenario {
  id: string;
  scenario_letter: string;
  name: string;
  description: string;
  target_service: string;
  failure_type: string;
  expected_status: number;
  error_code: string;
  user_effect: string;
  required_action: string;
  verification_endpoints: string[];
  dependency_impact: string[];
}

export interface ChaosStatusResponse {
  active_scenario: ChaosScenario | null;
  subsystems: {
    products_catalog: 'healthy' | 'unhealthy';
    inventory: 'healthy' | 'unhealthy';
    checkout: 'healthy' | 'unhealthy';
    payment: 'healthy' | 'unhealthy';
  };
}

export interface CheckoutResponse {
  status: string;
  service: string;
  order_id: string;
  items_count: number;
  total_amount: number;
  payment_method: string;
  shipping_address: Record<string, any>;
  estimated_delivery: string;
}

export interface PaymentProcessResponse {
  status: string;
  service: string;
  transaction_id: string;
  order_id: string;
  amount: number;
  currency: string;
}

export type RecoveryStage =
  | 'pending'
  | 'running'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'awaiting_approval'
  | 'aborted';

export interface RecoveryJob {
  id: string;
  incident_id: string;
  service: string;
  stage: RecoveryStage;
  status: string;
  current_step: string;
  current_step_index: number;
  total_steps: number;
  recovery_order: string[];
  action: string | null;
  logs: string[];
  evidence?: Record<string, any> | null;
  root_cause?: {
    failed_service: string;
    prerequisites?: string[];
    downstream_impact?: string[];
    recovery_order?: string[];
  } | null;
  recovery_strategy?: {
    type?: string;
    service?: string;
    action?: string;
    risk_level?: string;
    description?: string;
  } | null;
  stage_history?: Array<{
    stage: string;
    timestamp: string;
    message: string;
  }>;
  health_check_result?: {
    passed: boolean;
    health_check_type: string;
    message: string;
  } | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error?: string | null;
}

export interface RecoveryStartResponse {
  incident: Incident;
  job_id?: string;
  job?: RecoveryJob;
}

export interface RecoveryJobResponse {
  job: RecoveryJob;
}

export interface RecoveryStatusResponse {
  incident_id: string;
  status: string;
  active_job_id?: string;
  job?: RecoveryJob;
  jobs?: RecoveryJob[];
}

export interface ChangedFileReview {
  file_path: string;
  filename: string;
  directory: string;
  status: 'pending' | 'accepted' | 'rejected';
  additions: number;
  deletions: number;
  original_content_hash: string;
  original_content: string;
  proposed_content: string;
  diff_content: string;
}

export interface ChangeSet {
  id: string;
  incident_id?: string | null;
  service: string;
  title: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'partially_reviewed' | 'applied';
  total_files: number;
  total_additions: number;
  total_deletions: number;
  created_at: string;
  applied_at?: string | null;
  files: ChangedFileReview[];
  validation_results?: {
    passed: boolean;
    total_checks: number;
    checks: Array<{
      file: string;
      check: string;
      passed: boolean;
      error?: string;
      message?: string;
    }>;
    timestamp: string;
  } | null;
}

export interface SOSRequest {
  service: string;
  reason?: string;
  reporter?: string;
  idempotency_key?: string;
}

export interface SOSResponse {
  status: string;
  incident_id: string;
  current_status: IncidentStatus;
  incident: Incident;
  service: string;
  message: string;
  audit_event_id?: string;
  duplicate?: boolean;
}


