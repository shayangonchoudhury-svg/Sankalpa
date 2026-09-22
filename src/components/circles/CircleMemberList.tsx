import { useState } from 'react';
import { Users, UserPlus, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { Circle, CircleMember } from '../../types/index.ts';

interface CircleMemberListProps {
  circle: Circle;
  members: CircleMember[];
  isOwner: boolean;
  onInvite: (email: string) => Promise<void>;
}

export default function CircleMemberList({
  circle,
  members,
  isOwner,
  onInvite,
}: CircleMemberListProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [showInviteInput, setShowInviteInput] = useState(false);

  const memberCount = circle.memberCount || members.length;
  const isCapReached = memberCount >= 10;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await onInvite(inviteEmail.trim());
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      setShowInviteInput(false);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="circle-member-list" className="space-y-4">
      {/* Header & Cap indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-600" />
          <h3 className="font-serif text-sm font-semibold text-neutral-900">
            Circle Members
          </h3>
          <span
            id="member-count-badge"
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              isCapReached
                ? 'bg-amber-100 text-amber-800'
                : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {memberCount} / 10
          </span>
        </div>

        {!isCapReached && !showInviteInput && (
          <button
            id="btn-open-invite-input"
            type="button"
            onClick={() => setShowInviteInput(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3F7D5C] hover:text-[#34684c] transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Invite Input Box */}
      {showInviteInput && (
        <form
          id="form-invite-member"
          onSubmit={handleSendInvite}
          className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-700">
              Invite by Email
            </span>
            <button
              id="btn-cancel-invite"
              type="button"
              onClick={() => {
                setShowInviteInput(false);
                setInviteError(null);
              }}
              className="text-[11px] text-neutral-500 hover:text-neutral-700"
            >
              Cancel
            </button>
          </div>

          <div className="flex gap-2">
            <input
              id="input-circle-invite-email"
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3F7D5C] focus:border-[#3F7D5C]"
              required
            />
            <button
              id="btn-submit-circle-invite"
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
          </div>

          {inviteError && (
            <p id="invite-error-msg" className="text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{inviteError}</span>
            </p>
          )}
        </form>
      )}

      {inviteSuccess && (
        <div id="invite-success-msg" className="p-2.5 bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 rounded-lg flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{inviteSuccess}</span>
        </div>
      )}

      {/* Member Cards */}
      <div id="circle-members-container" className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden bg-white">
        {members.map((member) => {
          const isOwnerMember = member.uid === circle.ownerId;

          return (
            <div
              key={member.uid}
              id={`circle-member-${member.uid}`}
              className="p-3 flex items-center justify-between hover:bg-neutral-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center font-serif font-bold text-xs text-neutral-700">
                  {(member.email?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-900">
                      {member.email || member.uid}
                    </span>
                    {isOwnerMember && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <Shield className="w-2.5 h-2.5" />
                        Owner
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 capitalize">
                    {member.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scope Note: Member removal is not implemented in this phase */}
      <p className="text-[11px] text-neutral-400 italic">
        Circles support up to 10 accepted members. Member removal and participant removal are reserved for future phases.
      </p>
    </div>
  );
}
