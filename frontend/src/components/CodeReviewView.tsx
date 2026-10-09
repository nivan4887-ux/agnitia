import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Sparkles,
  RefreshCw,
  FolderGit2,
} from 'lucide-react';
import { ChangeSet } from '../types';
import { api } from '../services/api';
import { CodeChangeReviewPanel } from './CodeChangeReviewPanel';

interface CodeReviewViewProps {
  onRefresh?: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const CodeReviewView: React.FC<CodeReviewViewProps> = ({
  onRefresh,
  onError,
  onSuccess,
}) => {
  const [changeSets, setChangeSets] = useState<ChangeSet[]>([]);
  const [activeChangeSetId, setActiveChangeSetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState<boolean>(false);

  const fetchChangeSets = async () => {
    setIsLoading(true);
    try {
      const res = await api.listCodeChanges();
      setChangeSets(res.changesets);
      if (res.changesets.length > 0 && !activeChangeSetId) {
        setActiveChangeSetId(res.changesets[res.changesets.length - 1].id);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to fetch code change sets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChangeSets();
  }, []);

  const activeChangeSet = changeSets.find((cs) => cs.id === activeChangeSetId) || changeSets[0];

  const handleUpdateChangeSet = (updated: ChangeSet) => {
    setChangeSets((prev) =>
      prev.map((cs) => (cs.id === updated.id ? updated : cs))
    );
  };

  const handleGenerateDemoPatch = async () => {
    setIsGeneratingDemo(true);
    try {
      // Propose real patch against scratch files / store definitions
      const res = await api.proposeCodeChangeSet({
        title: 'Patch Connection Pool & Standalone Resilience',
        description:
          'Hardens database pool timeout parameter and adds structured recovery diagnostics in standalone service.',
        service: 'backend_api',
        file_patches: {
          'standalone_service/server.py': `"""
Independent Python Demo Service with Resilient Pool & Catalog Health.
"""
from __future__ import annotations
import http.server
import json
import os
import sys

PORT = 8001
HOST = "127.0.0.1"

# Hardened connection pool limit
MAX_POOL_LIMIT = 50
POOL_TIMEOUT_SECONDS = 3.0

print(f"[STANDALONE] Starting hardened service with pool limit {MAX_POOL_LIMIT}...")
`,
          'app/demo_store.py': `"""
BRIDGE – In-Process Demo Store Subsystems & Diagnostics (Hotpatched).
"""
from __future__ import annotations
import time
from typing import Any, Dict, List

# Optimized connection pool threshold
DEFAULT_POOL_CAPACITY = 100
POOL_RECOVERY_BACKOFF_MS = 250
`,
        },
      });

      onSuccess(`Proposed patch ${res.changeset.id} generated with real unified diffs.`);
      await fetchChangeSets();
      setActiveChangeSetId(res.changeset.id);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to propose demo patch');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Codex Multi-File Code Change Review
            </h2>
            <p className="text-xs text-stone-500">
              Review source code repairs, inspect unified diffs, accept/reject individual files, and safely apply validated patches.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchChangeSets}
            disabled={isLoading}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E7E2D9] text-stone-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleGenerateDemoPatch}
            disabled={isGeneratingDemo}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGeneratingDemo ? 'Generating...' : 'Propose Sample Source Patch'}</span>
          </button>
        </div>
      </div>

      {/* Change Set Selector Tabs */}
      {changeSets.length > 1 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {changeSets.map((cs) => (
            <button
              key={cs.id}
              onClick={() => setActiveChangeSetId(cs.id)}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold transition shrink-0 border cursor-pointer ${
                cs.id === activeChangeSet?.id
                  ? 'bg-stone-900 text-white border-stone-800 shadow-sm'
                  : 'bg-white text-stone-600 border-[#E7E2D9] hover:bg-stone-50'
              }`}
            >
              <span>{cs.id}</span>
              <span className="ml-2 text-[10px] text-stone-400">
                ({cs.total_files} files, +{cs.total_additions}/-{cs.total_deletions})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main Review Panel */}
      {activeChangeSet ? (
        <CodeChangeReviewPanel
          changeSet={activeChangeSet}
          onUpdateChangeSet={handleUpdateChangeSet}
          onApplied={(appliedCs) => {
            onSuccess(`Change set ${appliedCs.id} applied and validated.`);
            if (onRefresh) onRefresh();
          }}
        />
      ) : (
        <div className="bg-white border border-[#EBE5DB] rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-bold text-stone-900">No Active Proposed Code Changes</h3>
            <p className="text-xs text-stone-500">
              Operational service recoveries execute through restart playbooks. For source repairs, propose a patch to review diffs.
            </p>
          </div>
          <button
            onClick={handleGenerateDemoPatch}
            disabled={isGeneratingDemo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center space-x-2 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Propose Sample Source Patch</span>
          </button>
        </div>
      )}
    </div>
  );
};
