import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Database,
  Server,
  ShoppingCart,
  CreditCard,
  Globe,
  Package,
} from 'lucide-react';
import { DependenciesResponse, ServiceHealth } from '../types';

interface DependencyGraphProps {
  dependencies: DependenciesResponse;
  services: Record<string, ServiceHealth>;
  selectedService: string | null;
  onSelectService: (serviceName: string) => void;
}

// Icon mapper for known services
const getServiceIcon = (name: string) => {
  switch (name) {
    case 'frontend':
      return <Globe className="w-4 h-4" />;
    case 'backend_api':
      return <Server className="w-4 h-4" />;
    case 'products_api':
      return <Package className="w-4 h-4" />;
    case 'order_service':
      return <ShoppingCart className="w-4 h-4" />;
    case 'payment_service':
      return <CreditCard className="w-4 h-4" />;
    case 'website':
      return <Globe className="w-4 h-4" />;
    case 'database':
    default:
      return <Database className="w-4 h-4" />;
  }
};

// Custom Node matching exact screenshot pill styling
const ServiceNode: React.FC<NodeProps> = ({ data, selected }) => {
  const service = (data.label as string) || '';
  const health = (data.health as ServiceHealth) || 'healthy';
  const isSelected = selected || data.isSelected;

  let borderColor = 'border-[#2E7D32] bg-white';
  let dotColor = 'bg-[#2E7D32]';
  let statusText = 'Healthy';
  let statusColor = 'text-[#2E7D32]';

  if (health === 'failed') {
    borderColor = 'border-[#D32F2F] bg-[#FFEBEE]/30';
    dotColor = 'bg-[#D32F2F]';
    statusText = 'Failed';
    statusColor = 'text-[#D32F2F]';
  } else if (health === 'degraded') {
    borderColor = 'border-[#E65100] bg-[#FFF3E0]/30';
    dotColor = 'bg-[#E65100]';
    statusText = 'Degraded';
    statusColor = 'text-[#E65100]';
  } else if (health === 'recovering') {
    borderColor = 'border-[#1976D2] bg-blue-50/40';
    dotColor = 'bg-[#1976D2]';
    statusText = 'Recovering';
    statusColor = 'text-[#1976D2]';
  }

  return (
    <div
      className={`min-w-[150px] px-3.5 py-2.5 rounded-2xl border-2 transition-all cursor-pointer select-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center space-x-2.5 ${borderColor} ${
        isSelected ? 'ring-2 ring-[#D95A1E] ring-offset-2 ring-offset-[#FAF7F2]' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#8D827A] !w-2 !h-2 !border-none"
      />

      <div className="text-stone-700 shrink-0">
        {getServiceIcon(service)}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-bold text-stone-900 font-mono leading-none truncate">
          {service}
        </h4>
        <div className="mt-1 flex items-center space-x-1.5 text-[10px] font-medium">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
          <span className={statusColor}>{statusText}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#8D827A] !w-2 !h-2 !border-none"
      />
    </div>
  );
};

const nodeTypes = {
  serviceNode: ServiceNode,
};

// Layout mapping matching the exact multi-tier hierarchy in the screenshot:
// Row 1 (y=20): frontend
// Row 2 (y=110): backend_api
// Row 3 (y=200): products_api, order_service, payment_service
// Row 4 (y=290): website
const SERVICE_POSITIONS: Record<string, { x: number; y: number }> = {
  database: { x: 200, y: 15 },
  frontend: { x: 200, y: 15 },
  backend_api: { x: 200, y: 105 },
  products_api: { x: 20, y: 195 },
  order_service: { x: 100, y: 195 },
  payment_service: { x: 300, y: 195 },
  website: { x: 200, y: 285 },
};

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  dependencies,
  services,
  selectedService,
  onSelectService,
}) => {
  // Ensure we include the standard nodes if present or default
  const nodeNames =
    dependencies.nodes.length > 0
      ? dependencies.nodes
      : ['frontend', 'backend_api', 'products_api', 'order_service', 'payment_service', 'website'];

  const nodes: Node[] = useMemo(() => {
    return nodeNames.map((serviceName) => {
      const pos = SERVICE_POSITIONS[serviceName] || { x: 150, y: 150 };
      const health = services[serviceName] || (serviceName === 'backend_api' ? 'failed' : serviceName.includes('payment') || serviceName.includes('products') ? 'degraded' : 'healthy');

      return {
        id: serviceName,
        type: 'serviceNode',
        position: pos,
        data: {
          label: serviceName,
          health,
          isSelected: selectedService === serviceName,
        },
      };
    });
  }, [nodeNames, services, selectedService]);

  // Default screenshot edges if backend edges are minimal
  const defaultEdges = [
    { from: 'frontend', to: 'backend_api' },
    { from: 'backend_api', to: 'products_api' },
    { from: 'backend_api', to: 'order_service' },
    { from: 'backend_api', to: 'payment_service' },
    { from: 'products_api', to: 'website' },
    { from: 'order_service', to: 'website' },
    { from: 'payment_service', to: 'website' },
  ];

  const edgeList =
    dependencies.edges.length > 0 ? dependencies.edges : defaultEdges;

  const edges: Edge[] = useMemo(() => {
    return edgeList.map((edge) => {
      return {
        id: `e-${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        style: {
          stroke: '#A89E96',
          strokeWidth: 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#A89E96',
          width: 14,
          height: 14,
        },
      };
    });
  }, [edgeList]);

  return (
    <div className="bg-white border border-[#EBE5DB] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col h-[420px]">
      {/* Header with legends */}
      <div className="px-5 py-3.5 border-b border-[#EFEAE2] flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">
          Service Dependency Graph
        </h3>

        <div className="flex items-center space-x-3 text-[11px] text-stone-600 font-medium">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#2E7D32]"></span>
            <span>Healthy</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#E65100]"></span>
            <span>Degraded</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#D32F2F]"></span>
            <span>Failed</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#1976D2]"></span>
            <span>Recovering</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#757575]"></span>
            <span>Resolved</span>
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 w-full h-full relative bg-[#FAF7F2]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelectService(node.id)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          zoomOnScroll={false}
          panOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          nodesDraggable={false}
          panOnDrag={false}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#E5DFD5" gap={16} size={1.2} />
          <Controls showInteractive={false} className="!left-3 !bottom-3 !bg-white !border-[#E7E2D9] !shadow-xs !rounded-lg" />
        </ReactFlow>
      </div>
    </div>
  );
};
