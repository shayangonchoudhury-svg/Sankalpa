import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Target, Users, Calendar, ChevronDown, ChevronUp, CheckCircle, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.ts';
import { Challenge, ChallengeParticipant, Commitment } from '../../types/index.ts';

interface ChallengeCardProps {
  challenge: Challenge;
  currentUserId: string;
  participants?: ChallengeParticipant[];
  participantCommitments?: Record<string, Commitment>;
}

export default function ChallengeCard({
  challenge,
  currentUserId,
  participants: propParticipants,
  participantCommitments: propCommitments,
}: ChallengeCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>(propParticipants || []);
  const [participantCommitments, setParticipantCommitments] = useState<Record<string, Commitment>>(propCommitments || {});
  const [loading, setLoading] = useState(!propParticipants || propParticipants.length === 0);

  useEffect(() => {
    // If participants were passed via props and non-empty, use them
    if (propParticipants && propParticipants.length > 0) {
      setParticipants(propParticipants);
      if (propCommitments) {
        setParticipantCommitments(propCommitments);
      }
      setLoading(false);
      return;
    }

    if (!challenge.id) return;

    // Reactively subscribe to challenge participant documents from challenges/{challengeId}/participants
    const participantsRef = collection(db, 'challenges', challenge.id, 'participants');
    const unsubscribe = onSnapshot(
      participantsRef,
      async (snapshot) => {
        const parts: ChallengeParticipant[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ChallengeParticipant;
          if (data && data.uid && data.commitmentId) {
            parts.push({
              uid: data.uid,
              circleId: data.circleId,
              commitmentId: data.commitmentId,
              joinedAt: data.joinedAt,
            });
          }
        });

        // Fetch corresponding commitments to verify existence and fetch details
        const commitmentsMap: Record<string, Commitment> = {};
        for (const part of parts) {
          if (part.commitmentId) {
            try {
              const cSnap = await getDoc(doc(db, 'commitments', part.commitmentId));
              if (cSnap.exists()) {
                commitmentsMap[part.uid] = {
                  id: cSnap.id,
                  ...(cSnap.data() as Omit<Commitment, 'id'>),
                };
              }
            } catch (err) {
              console.warn(`Could not verify commitment ${part.commitmentId}:`, err);
            }
          }
        }

        // Only participants with an existing valid commitment document are counted
        const verifiedParticipants = parts.filter((p) => commitmentsMap[p.uid] !== undefined);
        setParticipants(verifiedParticipants);
        setParticipantCommitments(commitmentsMap);
        setLoading(false);
      },
      (err) => {
        console.warn(`Error loading participants for challenge ${challenge.id}:`, err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [challenge.id, propParticipants, propCommitments]);

  const userParticipant = participants.find((p) => p.uid === currentUserId);
  const userCommitment = userParticipant && userParticipant.commitmentId
    ? participantCommitments[currentUserId]
    : undefined;

  return (
    <div
      id={`challenge-card-${challenge.id}`}
      className="p-4 rounded-xl border border-neutral-200 bg-white space-y-3.5 shadow-2xs hover:border-neutral-300 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[#3F7D5C]/10 text-[#3F7D5C]">
              <Target className="w-4 h-4" />
            </span>
            <h4 className="font-serif text-sm font-semibold text-neutral-900 tracking-tight">
              {challenge.title}
            </h4>
          </div>
          {challenge.description && (
            <p className="text-xs text-neutral-600 leading-relaxed">
              {challenge.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full capitalize">
            <Calendar className="w-3 h-3" />
            {challenge.cadence}
          </span>
        </div>
      </div>

      {/* Participants Summary & Toggle */}
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-neutral-600 font-medium">
          <Users className="w-3.5 h-3.5 text-neutral-500" />
          <span>{participants.length} Active Participants</span>
        </div>

        <button
          id={`btn-toggle-participants-${challenge.id}`}
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Participant List */}
      {isExpanded && (
        <div
          id={`challenge-participants-${challenge.id}`}
          className="space-y-2 pt-1 animate-in fade-in duration-150"
        >
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-100 bg-neutral-50/60 overflow-hidden">
            {participants.map((p) => {
              const comm = participantCommitments[p.uid];
              const isCurrentUser = p.uid === currentUserId;

              return (
                <div
                  key={p.uid}
                  id={`participant-row-${p.uid}`}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center font-bold text-[10px] text-neutral-700">
                      {(p.uid.substring(0, 2)).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-neutral-800">
                        {isCurrentUser ? 'You' : `Member ${p.uid.substring(0, 6)}`}
                      </span>
                      {comm && (
                        <p className="text-[10px] text-neutral-400">
                          {comm.title} • {comm.visibility}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Commitment link */}
                  {comm && (
                    <Link
                      id={`link-view-commitment-${comm.id}`}
                      to={`/commitments/${comm.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3F7D5C] hover:underline"
                    >
                      <span>{isCurrentUser ? 'Check In / View' : 'View Vow'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Action for Current User */}
      {userCommitment && (
        <div className="pt-1">
          <Link
            id={`btn-challenge-checkin-${challenge.id}`}
            to={`/commitments/${userCommitment.id}`}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors shadow-2xs"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Open Your Challenge Commitment</span>
          </Link>
        </div>
      )}
    </div>
  );
}
