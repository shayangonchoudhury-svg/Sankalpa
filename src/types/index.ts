export type Cadence = 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom';

export type Visibility = 'private' | 'circle' | 'public' | 'witnesses_only';

export type EvidenceType = 'photo' | 'video' | 'link' | 'text' | 'metric';

export type CheckinStatus = 'pending' | 'verified' | 'rejected' | 'disputed';

export type WitnessResponseType = 'approved' | 'asked_for_more' | 'flagged' | 'confirm' | 'reject' | 'cheer';

export interface Commitment {
  id?: string;
  ownerId: string;
  title: string;
  cadence: Cadence | string;
  visibility: Visibility | string;
  circleId?: string;
  challengeId?: string;
  createdAt: Date | string | number | any;
  description?: string;
  archived?: boolean;
}

export interface AiFlag {
  flagged: boolean;
  reason?: string | null;
}

export interface Checkin {
  id?: string;
  commitmentId: string;
  userId: string;
  evidenceType: EvidenceType | string;
  evidenceUrl?: string;
  note?: string;
  timestamp: Date | string | number;
  status: CheckinStatus | string;
  aiFlag?: AiFlag;
}

export interface WitnessAction {
  id?: string;
  checkinId: string;
  witnessId: string;
  responseType: WitnessResponseType | string;
  timestamp: Date | string | number | any;
  note?: string;
}

export type WitnessInviteStatus = 'pending' | 'accepted' | 'declined';

export interface WitnessInvite {
  id?: string;
  commitmentId: string;
  fromUserId: string;
  toEmail: string;
  toUserId?: string | null;
  status: WitnessInviteStatus | string;
  createdAt: Date | string | number | any;
}

export interface WitnessMembership {
  uid: string;
  status: 'accepted';
  inviteId?: string;
  createdAt?: Date | string | number | any;
}

export interface Circle {
  id?: string;
  name: string;
  ownerId: string;
  memberCount?: number;
  members?: string[];
  createdAt: Date | string | number | any;
}

export interface CircleMember {
  uid: string;
  email: string;
  status: 'pending' | 'accepted';
  invitedBy?: string;
  inviteId?: string;
  createdAt?: Date | string | number | any;
}

export interface CircleInvite {
  id?: string;
  circleId: string;
  circleName: string;
  fromUserId: string;
  toEmail: string;
  toUserId?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date | string | number | any;
}

export interface Challenge {
  id?: string;
  circleId: string;
  title: string;
  cadence: Cadence | string;
  description?: string;
  createdBy: string;
  createdAt: Date | string | number | any;
  active: boolean;
}

export interface ChallengeParticipant {
  uid: string;
  circleId: string;
  commitmentId: string;
  joinedAt: Date | string | number | any;
}

export interface NotificationPrefs {
  checkinDue: boolean;
  witnessInvited: boolean;
  witnessResponded: boolean;
  challengeStarted: boolean;
}

export type NotificationType =
  | 'checkin_due'
  | 'witness_invited'
  | 'witness_responded'
  | 'challenge_started';

export interface AppNotification {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedId: string;
  read: boolean;
  createdAt: Date | string | number | any;
}

export interface User {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
  notificationPrefs?: NotificationPrefs;
}
