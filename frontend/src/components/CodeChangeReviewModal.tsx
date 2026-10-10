import React from 'react';
import { ChangeSet } from '../types';
import { CodeChangeReviewPanel } from './CodeChangeReviewPanel';

interface CodeChangeReviewModalProps {
  changeSet: ChangeSet | null;
  onUpdateChangeSet: (updated: ChangeSet) => void;
  onApplied?: (updated: ChangeSet) => void;
  onClose: () => void;
}

export const CodeChangeReviewModal: React.FC<CodeChangeReviewModalProps> = ({
  changeSet,
  onUpdateChangeSet,
  onApplied,
  onClose,
}) => {
  if (!changeSet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 animate-in fade-in duration-150 overflow-hidden">
      <div className="w-full max-w-5xl h-[92vh] max-h-[820px] flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden rounded-2xl shadow-2xl border border-zinc-800">
        <CodeChangeReviewPanel
          changeSet={changeSet}
          onUpdateChangeSet={onUpdateChangeSet}
          onApplied={onApplied}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
