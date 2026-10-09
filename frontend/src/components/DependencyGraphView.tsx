import React from 'react';
import { Network, Server, Flame, FileCode } from 'lucide-react';
import { DependenciesResponse, ServiceHealth } from '../types';
import { DependencyGraph } from './DependencyGraph';

interface DependencyGraphViewProps {
  dependencies: DependenciesResponse;
  services: Record<string, ServiceHealth>;
  selectedService: string;
  onSelectService: (service: string) => void;
  onInspectPlan: (service: string) => void;
  onSimulateFailure: (service: string) => void;
}

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({
  dependencies,
  services,
  selectedService,
  onSelectService,
  onInspectPlan,
  onSimulateFailure,
}) => {
  // Compute upstream prerequisites for selected service
  const upstreamPrereqs = dependencies.edges
    .filter((e) => e.to === selectedService)
    .map((e) => e.from);

  // Compute downstream dependents for selected service
  const downstreamDependents = dependencies.edges
    .filter((e) => e.from === selectedService)
    .map((e) => e.to);

  const selectedHealth = services[selectedService] || 'healthy';

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#D95A1E] text-white flex items-center justify-center shadow-md">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Service Dependency Graph & Blast Radius
            </h2>
            <p className="text-xs text-stone-500">
              Deterministic Directed Acyclic Graph (DAG) for topology traversal and safe recovery ordering.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-mono bg-stone-50 px-3 py-2 rounded-lg border border-stone-200/80">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span className="text-stone-700">Healthy</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
            <span className="text-stone-700">Degraded / Recovering</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span className="text-stone-700">Failed</span>
          </div>
        </div>
      </div>

      {/* Main Graph & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Full-size Dependency Graph Canvas (~65% width) */}
        <div className="lg:col-span-8">
          <DependencyGraph
            dependencies={dependencies}
            services={services}
            selectedService={selectedService}
            onSelectService={onSelectService}
          />
        </div>

        {/* Selected Service Topology Inspector (~35% width) */}
        <div className="lg:col-span-4 bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-[#D95A1E]" />
              <h3 className="text-sm font-bold text-stone-900">Topology Node Inspector</h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                selectedHealth === 'healthy'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {selectedHealth}
            </span>
          </div>

          <div>
            <span className="text-xs text-stone-500 font-mono">Selected Node:</span>
            <p className="text-base font-bold text-stone-900 font-mono mt-0.5">{selectedService}</p>
          </div>

          {/* Upstream Prerequisites */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-stone-700 block">
              Upstream Prerequisites (Must Be Healthy First):
            </span>
            {upstreamPrereqs.length === 0 ? (
              <p className="text-xs text-stone-400 font-mono italic">
                None (Root Tier 0 infrastructure node)
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {upstreamPrereqs.map((u) => (
                  <span
                    key={u}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-stone-50 border border-stone-200/80 text-stone-800"
                  >
                    {u}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Downstream Blast Radius */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-stone-700 block">
              Downstream Consumers Impacted If This Fails:
            </span>
            {downstreamDependents.length === 0 ? (
              <p className="text-xs text-stone-400 font-mono italic">
                None (Leaf edge presentation node)
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {downstreamDependents.map((d) => (
                  <span
                    key={d}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-amber-50 border border-amber-200 text-amber-800"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="pt-3 border-t border-stone-200/80 space-y-2">
            <button
              onClick={() => onInspectPlan(selectedService)}
              className="w-full py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200/80 text-stone-800 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-stone-600" />
              <span>Inspect Recovery Plan for {selectedService}</span>
            </button>

            <button
              onClick={() => onSimulateFailure(selectedService)}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Failure on {selectedService}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
