import { useCheckinWitnessActions, WitnessActionWithProfile } from '../../hooks/useWitnessActions.ts';

interface CheckinWitnessResponsesProps {
  checkinId?: string;
  actions?: WitnessActionWithProfile[];
}

export default function CheckinWitnessResponses({ checkinId, actions: externalActions }: CheckinWitnessResponsesProps) {
  const { actions: hookActions, loading } = useCheckinWitnessActions(
    externalActions === undefined ? checkinId : undefined
  );
  const actions = externalActions !== undefined ? externalActions : hookActions;

  if (!checkinId || (externalActions === undefined && loading) || actions.length === 0) {
    return null;
  }

  return (
    <div
      id={`witness-responses-for-${checkinId}`}
      className="pt-2.5 mt-2 border-t border-neutral-100 space-y-2"
    >
      <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
        Witness Feedback
      </span>

      <div className="space-y-1.5">
        {actions.map((action) => {
          const name = action.witnessProfile?.displayName || action.witnessProfile?.email || 'Witness';
          const isApproved = action.responseType === 'approved';
          const isAskedForMore = action.responseType === 'asked_for_more';
          const isFlagged = action.responseType === 'flagged';

          let label = `Reviewed by ${name}`;
          let pillStyle = 'bg-neutral-100 text-neutral-700 border-neutral-200';

          if (isApproved) {
            label = `Approved by ${name}`;
            pillStyle = 'bg-[#3F7D5C]/10 text-[#3F7D5C] border-[#3F7D5C]/20';
          } else if (isAskedForMore) {
            label = `Asked for more by ${name}`;
            pillStyle = 'bg-neutral-100 text-neutral-700 border-neutral-200';
          } else if (isFlagged) {
            label = `Flagged by ${name}`;
            pillStyle = 'bg-[#C26D55]/10 text-[#C26D55] border-[#C26D55]/30';
          }

          return (
            <div
              key={action.id}
              id={`action-item-${action.id}`}
              className="space-y-1 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${pillStyle}`}
                >
                  {isApproved && <span className="mr-1">✓</span>}
                  {label}
                </span>
              </div>

              {action.note && (
                <p className="text-[11px] text-neutral-600 pl-2 border-l-2 border-neutral-200 py-0.5 italic leading-relaxed">
                  "{action.note}"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
