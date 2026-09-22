import { useState } from 'react';
import { useCommitments } from '../hooks/useCommitments.ts';
import CommitmentCard from '../components/commitments/CommitmentCard.tsx';
import CommitmentForm from '../components/commitments/CommitmentForm.tsx';
import { RitualOrbital } from '../components/shared/RitualOrbital.tsx';

export default function Home() {
  const { commitments, loading, error, retry } = useCommitments();
  const [isCreating, setIsCreating] = useState(false);

  // Filter only active commitments (archived !== true)
  const activeCommitments = commitments.filter((c) => !c.archived);

  return (
    <div id="page-home" className="p-4 space-y-6">
      {/* Top Header Section */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-serif text-2xl font-bold text-neutral-900 tracking-tight">
            Commitments
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Your personal vows and daily practices
          </p>
        </div>

        {!isCreating && (
          <button
            id="btn-new-commitment-top"
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Commitment</span>
          </button>
        )}
      </div>

      {/* Creation Modal / Expandable Card */}
      {isCreating && (
        <div
          id="section-create-commitment"
          className="p-4 rounded-[12px] border border-neutral-200 bg-neutral-50/70 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-200/80">
            <h2 className="font-serif text-base font-semibold text-neutral-900">
              New Personal Commitment
            </h2>
            <button
              id="btn-close-create-form"
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-neutral-400 hover:text-neutral-600 p-1 rounded transition-colors"
              aria-label="Close form"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <CommitmentForm
            mode="create"
            onSuccess={() => setIsCreating(false)}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      )}

      {/* 1. Loading State */}
      {loading && (
        <div id="home-loading-commitments" className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-4 bg-neutral-200 rounded w-1/3" />
                <div className="h-4 bg-neutral-100 rounded-full w-14" />
              </div>
              <div className="h-3 bg-neutral-100 rounded w-2/3" />
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                <div className="h-3 bg-neutral-100 rounded w-24" />
                <div className="h-3 bg-neutral-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Error State */}
      {!loading && error && (
        <div id="home-error-commitments" className="p-4 rounded-[12px] bg-red-50/80 border border-red-200 text-xs text-red-700 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-red-800">Unable to sync commitments</p>
              <p className="mt-0.5 text-[11px] text-red-600 leading-relaxed">{error}</p>
            </div>
            <button
              id="btn-retry-commitments"
              type="button"
              onClick={retry}
              className="px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:text-red-800 bg-white border border-red-300 rounded shadow-2xs hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 3. Empty State */}
      {!loading && !error && activeCommitments.length === 0 && !isCreating && (
        <div
          id="home-empty-commitments"
          className="py-14 px-6 rounded-[12px] border border-dashed border-neutral-200 bg-neutral-50/50 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute inset-0 -m-10 flex items-center justify-center -z-0 text-neutral-400 opacity-25">
              <RitualOrbital size="sm" showNodes={false} />
            </div>
            <div className="w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#3F7D5C] shadow-2xs relative z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className="font-serif text-lg font-semibold text-neutral-900 mb-1.5">
            No commitments yet
          </h2>
          <p className="text-xs text-neutral-500 max-w-[260px] leading-relaxed mb-5">
            Anchor yourself by setting a simple intention.
          </p>
          <button
            id="btn-create-first-commitment"
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Commitment</span>
          </button>
        </div>
      )}

      {/* 4. Populated State: Commitments List */}
      {!loading && activeCommitments.length > 0 && (
        <div id="home-commitments-list" className="space-y-3">
          {activeCommitments.map((commitment) => (
            <CommitmentCard key={commitment.id} commitment={commitment} />
          ))}
        </div>
      )}
    </div>
  );
}
