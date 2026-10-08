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
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Layers,
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
    case 'database':
      return <Database className="w-5 h-5" />;
    case 'backend_api':
      return <Server className="w-5 h-5" />;
    case 'order_service':
      return <ShoppingCart className="w-5 h-5" />;
    case 'payment_service':
      return <CreditCard className="w-5 h-5" />;
    case 'website':
      return <Globe className="w-5 h-5" />;
    default:
      return <Layers className="w-5 h-5" />;
  }
};

// Custom Node Component for React Flow
const ServiceNode: React.FC<NodeProps> = ({ data, selected }) => {
  const service = (data.label as string) || '';
  const health = (data.health as ServiceHealth) || 'healthy';
  const isSelected = selected || data.isSelected;

  let borderColor = 'border-[#E7E2D9] shadow-xs';
  let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let iconBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let statusIcon = <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;

  if (health === 'failed') {
    borderColor = 'border-rose-500 shadow-sm animate-pulse';
    badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
    iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
    statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
  } else if (health === 'degraded') {
    borderColor = 'border-amber-400 shadow-xs';
    badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
    iconBg = 'bg-amber-50 text-amber-600 border-amber-200';
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
  } else if (health === 'recovering') {
    borderColor = 'border-brand-500 shadow-sm animate-pulse';
    badgeBg = 'bg-brand-50 text-brand-800 border-brand-200';
    iconBg = 'bg-brand-50 text-brand-600 border-brand-200';
    statusIcon = <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" />;
  }

  return (
    <div
      className={`min-w-[170px] bg-white rounded-xl border-2 p-3 transition-all cursor-pointer select-none shadow-[0_1px_3px_rgba(40,25,15,0.06)] ${borderColor} ${
        isSelected ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-[#FAF8F5]' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-brand-600 !w-2.5 !h-2.5 !border-2 !border-white"
      />

      <div className="flex items-center space-x-2.5">
        <div className={`p-2 rounded-lg border ${iconBg}`}>
          {getServiceIcon(service)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-[#1C130D] truncate font-['JetBrains_Mono']">
            {service}
          </h4>
          <div className="mt-1 flex items-center space-x-1">
            <span
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeBg}`}
            >
              {statusIcon}
              <span className="uppercase">{health}</span>
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-brand-600 !w-2.5 !h-2.5 !border-2 !border-white"
      />
    </div>
  );
};

const nodeTypes = {
  serviceNode: ServiceNode,
};

// Fixed positions for a clear deterministic DAG layout
const SERVICE_POSITIONS: Record<string, { x: number; y: number }> = {
  database: { x: 40, y: 150 },
  backend_api: { x: 270, y: 150 },
  order_service: { x: 500, y: 70 },
  payment_service: { x: 500, y: 230 },
  website: { x: 740, y: 150 },
};

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  dependencies,
  services,
  selectedService,
  onSelectService,
}) => {
  // Construct nodes from dependencies response and health state
  const nodes: Node[] = useMemo(() => {
    return dependencies.nodes.map((serviceName) => {
      const pos = SERVICE_POSITIONS[serviceName] || { x: 100, y: 100 };
      const health = services[serviceName] || 'healthy';

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
  }, [dependencies.nodes, services, selectedService]);

  // Construct edges with arrows
  const edges: Edge[] = useMemo(() => {
    return dependencies.edges.map((edge) => {
      const sourceHealth = services[edge.from] || 'healthy';
      const isFailed = sourceHealth === 'failed' || sourceHealth === 'degraded';

      return {
        id: `e-${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        animated: isFailed,
        style: {
          stroke: isFailed ? '#DC2626' : '#8C7E72',
          strokeWidth: isFailed ? 2.5 : 1.75,
          strokeDasharray: isFailed ? '5 5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isFailed ? '#DC2626' : '#8C7E72',
          width: 16,
          height: 16,
        },
      };
    });
  }, [dependencies.edges, services]);

  return (
    <div className="bg-white border border-[#E7E2D9] rounded-xl overflow-hidden shadow-sm flex flex-col h-[380px]">
      <div className="px-4 py-3 border-b border-[#E7E2D9] flex items-center justify-between bg-warm-50/70">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-[#1C130D]">
            Directed Service Dependency Graph
          </h3>
          <span className="text-xs text-stone-500">
            (Edge A → B means B depends on A)
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px] text-stone-600 font-medium">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Healthy</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Degraded</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Failed</span>
          </span>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative bg-[#FAF8F5]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelectService(node.id)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#E5DFD5" gap={18} size={1.2} />
          <Controls showInteractive={false} className="!left-2 !bottom-2" />
        </ReactFlow>
      </div>
    </div>
  );
};

