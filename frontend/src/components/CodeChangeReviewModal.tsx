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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 md:p-10 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
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
