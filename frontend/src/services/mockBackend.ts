import type {
  ServiceHealth,
  DependenciesResponse,
  Incident,
  Approval,
  AuditEvent,
  RecoveryPlanResponse,
  RecoveryAssessment,
  DemoProduct,
  ChangeSet,
  DataIntegrityStatusResponse,
} from '../types';

// In-Memory Simulated State for Standalone & Vercel Offline Demo Mode
let mockServices: Record<string, ServiceHealth> = {
  database: 'healthy',
  backend_api: 'healthy',
  order_service: 'healthy',
  payment_service: 'healthy',
  website: 'healthy',
};

const mockDependencies: DependenciesResponse = {
  nodes: ['database', 'backend_api', 'order_service', 'payment_service', 'website'],
  edges: [
    { from: 'database', to: 'backend_api' },
    { from: 'backend_api', to: 'order_service' },
    { from: 'backend_api', to: 'payment_service' },
    { from: 'order_service', to: 'website' },
    { from: 'payment_service', to: 'website' },
  ],
};

let mockIncidents: Incident[] = [];
let mockApprovals: Approval[] = [];
let mockAuditLogs: AuditEvent[] = [
  {
    id: 'audit-boot-01',
    incident_id: null,
    event_type: 'SYSTEM_BOOT',
    service: 'backend_api',
    details: { message: 'BRIDGE telemetry engine initialized successfully.' },
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

let mockQuarantine: any[] = [];

const mockProducts: DemoProduct[] = [
  {
    id: 'prod-m-101',
    name: 'Banarasi Raw Silk Zari Sherwani',
    price: 8499,
    original_price: 11999,
    discount_percent: 29,
    category: 'Men',
    in_stock: true,
    stock_count: 18,
    description: 'Heritage raw silk sherwani with woven zari brocade.',
  },
  {
    id: 'prod-m-102',
    name: 'Tussar Silk Bandhgala Nehru Jacket',
    price: 3299,
    original_price: 4699,
    discount_percent: 30,
    category: 'Men',
    in_stock: true,
    stock_count: 24,
    description: 'Textured sleeveless Nehru jacket in handspun Tussar silk.',
  },
  {
    id: 'prod-w-201',
    name: 'Kanjeevaram Pure Mulberry Silk Saree',
    price: 12499,
    original_price: 17999,
    discount_percent: 31,
    category: 'Women',
    in_stock: true,
    stock_count: 12,
    description: 'Traditional pure silk saree with temple border motifs.',
  },
  {
    id: 'prod-w-202',
    name: 'Chanderi Handloom Anarkali Suit',
    price: 4999,
    original_price: 6999,
    discount_percent: 28,
    category: 'Women',
    in_stock: true,
    stock_count: 30,
    description: 'Handcrafted pure cotton-silk floral Anarkali ensemble.',
  },
  {
    id: 'prod-s-301',
    name: 'Oversized Acid Wash Graphic Hoodie',
    price: 2499,
    original_price: 3499,
    discount_percent: 28,
    category: 'Streetwear',
    in_stock: true,
    stock_count: 40,
    description: 'Heavyweight fleece hoodie with dropped shoulders.',
  },
  {
    id: 'prod-a-401',
    name: 'Kundan Meenakari Choker & Jhumka Set',
    price: 3499,
    original_price: 4999,
    discount_percent: 30,
    category: 'Accessories',
    in_stock: true,
    stock_count: 15,
    description: 'Handmade bridal choker with matching floral jhumkas.',
  },
];

const getDownstream = (service: string): string[] => {
  const map: Record<string, string[]> = {
    database: ['backend_api', 'order_service', 'payment_service', 'website'],
    backend_api: ['order_service', 'payment_service', 'website'],
    order_service: ['website'],
    payment_service: ['website'],
    website: [],
  };
  return map[service] || [];
};

export const resetMockState = () => {
  mockServices = {
    database: 'healthy',
    backend_api: 'healthy',
    order_service: 'healthy',
    payment_service: 'healthy',
    website: 'healthy',
  };
  mockIncidents = [];
  mockApprovals = [];
};

export const mockDispatch = async (url: string, options?: RequestInit): Promise<any> => {
  // Extract path and query from full URL
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const method = (options?.method || 'GET').toUpperCase();
  const body = options?.body ? JSON.parse(options.body as string) : {};

  // 1. Health check
  if (path === '/' && method === 'GET') {
    return { status: 'ok', service: 'BRIDGE Simulation Engine' };
  }

  // 2. Services list
  if (path === '/services' && method === 'GET') {
    return { services: { ...mockServices } };
  }

  // 3. Dependencies Graph
  if (path === '/dependencies' && method === 'GET') {
    return mockDependencies;
  }

  // 4. Incidents
  if (path === '/incidents' && method === 'GET') {
    return { incidents: [...mockIncidents] };
  }

  if (path.startsWith('/incidents/') && method === 'GET' && !path.includes('/sos')) {
    const incId = decodeURIComponent(path.replace('/incidents/', ''));
    const inc = mockIncidents.find((i) => i.id === incId);
    if (!inc) throw new Error(`Incident '${incId}' not found`);
    return { incident: inc };
  }

  // 5. Simulate Failure / Inject Fault
  if ((path.startsWith('/simulate/fail/') || path === '/simulate/inject-fault') && method === 'POST') {
    let service = 'backend_api';
    let faultType = 'api_gateway_502_fault';

    if (path.startsWith('/simulate/fail/')) {
      service = decodeURIComponent(path.replace('/simulate/fail/', ''));
    } else if (body.service) {
      service = body.service;
      faultType = body.fault_type || faultType;
    }

    // Set service to failed
    mockServices[service] = 'failed';
    const downstream = getDownstream(service);
    downstream.forEach((ds) => {
      if (mockServices[ds] !== 'failed') mockServices[ds] = 'degraded';
    });

    const newIncident: Incident = {
      id: `inc-${Date.now().toString().slice(-4)}`,
      failed_service: service,
      affected_services: downstream,
      status: 'open',
      created_at: new Date().toISOString(),
      recovery_started_at: null,
      recovery_completed_at: null,
      total_recovery_duration_seconds: null,
      recovery_order: [service, ...downstream],
      current_step_index: 0,
      recovery_steps: [
        {
          service,
          status: 'failed',
          reason: `Simulated ${faultType} injected`,
          timestamp: new Date().toISOString(),
        },
      ],
      pending_approval_id: null,
    };

    mockIncidents.unshift(newIncident);

    mockAuditLogs.unshift({
      id: `audit-${Date.now()}`,
      incident_id: newIncident.id,
      event_type: 'FAULT_INJECTED',
      service,
      details: { fault_type: faultType, affected: downstream },
      timestamp: new Date().toISOString(),
    });

    return { incident: newIncident, status: 'simulated_failure_active' };
  }

  // 6. SOS Outage Trigger
  if (path === '/incidents/sos' && method === 'POST') {
    const service = body.service || 'backend_api';
    mockServices[service] = 'failed';
    const downstream = getDownstream(service);
    downstream.forEach((ds) => {
      mockServices[ds] = 'degraded';
    });

    const newIncident: Incident = {
      id: `sos-${Date.now().toString().slice(-4)}`,
      failed_service: service,
      affected_services: downstream,
      status: 'open',
      created_at: new Date().toISOString(),
      recovery_started_at: null,
      recovery_completed_at: null,
      total_recovery_duration_seconds: null,
      recovery_order: [service, ...downstream],
      current_step_index: 0,
      recovery_steps: [
        {
          service,
          status: 'failed',
          reason: body.reason || 'Priority-1 Emergency SOS Outage',
          timestamp: new Date().toISOString(),
        },
      ],
      pending_approval_id: null,
    };

    mockIncidents.unshift(newIncident);

    mockAuditLogs.unshift({
      id: `audit-${Date.now()}`,
      incident_id: newIncident.id,
      event_type: 'SOS_TRIGGERED',
      service,
      details: { reporter: body.reporter || 'Operator', reason: body.reason },
      timestamp: new Date().toISOString(),
    });

    return {
      incident: newIncident,
      sos_event: { incident_id: newIncident.id, level: 'P1_CRITICAL' },
    };
  }

  // 7. Recovery Plan & Assessment
  if (path.startsWith('/recovery/plan/') && method === 'GET') {
    const service = decodeURIComponent(path.replace('/recovery/plan/', ''));
    const downstream = getDownstream(service);
    const plan: RecoveryPlanResponse = {
      service,
      recovery_order: [service, ...downstream],
    };
    return plan;
  }

  if (path === '/recovery/assess' && method === 'POST') {
    const service = body.service || 'backend_api';
    const downstream = getDownstream(service);
    const assessment: RecoveryAssessment = {
      readiness_status: 'READY',
      risk_level: 'LOW',
      target_service: service,
      recovery_order: [service, ...downstream],
      downstream_impact: downstream,
      summary: `Automated recovery pre-check verified for ${service}. All prerequisite database locks cleared.`,
      findings: [
        {
          severity: 'info',
          code: 'CHECK_PASSED',
          message: 'Upstream health dependencies validated.',
          affected_service: service,
        },
      ],
      required_approvals: [],
      blocked_actions: [],
      recommended_next_step: 'Execute AI repair orchestrator.',
      state_fingerprint: 'demo-fp-01',
      assessed_at: new Date().toISOString(),
    };
    return assessment;
  }

  // 8. Propose Repair (15s simulated AI diff changeset)
  if (path.startsWith('/recovery/propose-repair/') && method === 'POST') {
    const incId = decodeURIComponent(path.replace('/recovery/propose-repair/', ''));
    const inc = mockIncidents.find((i) => i.id === incId) || mockIncidents[0];

    const changeset: ChangeSet = {
      id: `cs-${Date.now().toString().slice(-4)}`,
      incident_id: inc?.id || incId,
      service: inc?.failed_service || 'backend_api',
      title: `AI Autonomous Patch for ${inc?.failed_service || 'backend_api'}`,
      description: 'Resolves connection pool exhaustion, adds circuit breaker boundary, and applies safe restart latch.',
      status: 'pending',
      total_files: 2,
      total_additions: 14,
      total_deletions: 2,
      created_at: new Date().toISOString(),
      files: [
        {
          file_path: 'app/main.py',
          filename: 'main.py',
          directory: 'app',
          status: 'pending',
          additions: 8,
          deletions: 1,
          original_content_hash: 'hash-orig-main',
          original_content: '# Standard API Router\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n',
          proposed_content: '# Resilient API Router with Circuit Breaker\n@app.get("/health")\ndef health():\n    return {"status": "ok", "pool": "healthy"}\n',
          diff_content: `--- app/main.py (original)\n+++ app/main.py (repaired)\n@@ -24,4 +24,11 @@\n-# Standard API Router\n+# Resilient API Router with Circuit Breaker\n+POOL_CIRCUIT_BREAKER_ACTIVE = True\n @app.get("/health")\n def health():\n-    return {"status": "ok"}\n+    return {"status": "ok", "pool": "healthy"}`,
        },
        {
          file_path: 'app/catalog_data.py',
          filename: 'catalog_data.py',
          directory: 'app',
          status: 'pending',
          additions: 6,
          deletions: 1,
          original_content_hash: 'hash-orig-cat',
          original_content: 'RETRY_TIMEOUT = 1000\n',
          proposed_content: 'RETRY_TIMEOUT = 5000\nFALLBACK_CACHE_ACTIVE = True\n',
          diff_content: `--- app/catalog_data.py\n+++ app/catalog_data.py\n@@ -12,2 +12,7 @@\n-RETRY_TIMEOUT = 1000\n+RETRY_TIMEOUT = 5000\n+FALLBACK_CACHE_ACTIVE = True`,
        },
      ],
      validation_results: {
        passed: true,
        total_checks: 2,
        checks: [
          { file: 'app/main.py', check: 'Syntax & Type Validation', passed: true },
          { file: 'app/catalog_data.py', check: 'Schema Integrity Check', passed: true },
        ],
        timestamp: new Date().toISOString(),
      },
    };

    return { incident: inc, changeset };
  }

  // 9. Apply Code Changes / Recovery Start
  if (
    (path.includes('/code-changes/') && path.endsWith('/apply') && method === 'POST') ||
    (path.startsWith('/recovery/start/') && method === 'POST')
  ) {
    // Restore all services to healthy
    Object.keys(mockServices).forEach((s) => {
      mockServices[s] = 'healthy';
    });

    if (mockIncidents.length > 0) {
      mockIncidents[0].status = 'resolved';
      mockIncidents[0].recovery_completed_at = new Date().toISOString();
      mockIncidents[0].total_recovery_duration_seconds = 14;
    }

    mockAuditLogs.unshift({
      id: `audit-${Date.now()}`,
      incident_id: mockIncidents[0]?.id || null,
      event_type: 'RECOVERY_APPLIED',
      service: 'backend_api',
      details: { status: 'healthy', applied_changeset: 'verified' },
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'applied',
      incident: mockIncidents[0],
      applied_at: new Date().toISOString(),
      results: [{ file: 'app/main.py', status: 'success' }],
    };
  }

  // 10. Approvals
  if (path === '/approvals/pending' && method === 'GET') {
    return { pending_approvals: [...mockApprovals] };
  }

  if (path.startsWith('/approvals') && method === 'GET') {
    return { approvals: [...mockApprovals], total: mockApprovals.length };
  }

  // 11. Audit Logs
  if (path.startsWith('/audit') && method === 'GET') {
    return { audit_log: [...mockAuditLogs], total_events: mockAuditLogs.length };
  }

  // 12. Demo Products
  if (path.startsWith('/demo/products') && method === 'GET') {
    return {
      status: 'ok',
      products: mockProducts,
      item_count: mockProducts.length,
      total_available: mockProducts.length,
    };
  }

  // 13. Demo Health
  if (path === '/demo/health' && method === 'GET') {
    const isDegraded = mockServices.backend_api !== 'healthy';
    return {
      status: isDegraded ? 'degraded' : 'healthy',
      subsystems: {
        products_catalog: mockServices.backend_api === 'healthy' ? 'healthy' : 'unhealthy',
        inventory: 'healthy',
        checkout: 'healthy',
        payment: 'healthy',
      },
    };
  }

  // 14. Data Integrity
  if (path === '/integrity/status' && method === 'GET') {
    const status: DataIntegrityStatusResponse = {
      database_status: 'HEALTHY',
      contamination_rate_percent: 0,
      valid_records_count: 1048,
      quarantined_records_count: mockQuarantine.length,
      recovered_records_count: 0,
      purged_records_count: 0,
      stats: {
        total_ingested: 1048,
        valid_accepted: 1048,
        malformed_blocked: mockQuarantine.length,
        recovered_count: 0,
        last_violation_at: null,
      },
      valid_records: [],
      quarantined_records: mockQuarantine,
    };
    return status;
  }

  // Default fallback
  return { status: 'ok', message: 'Handled by BRIDGE Standalone Simulation' };
};
