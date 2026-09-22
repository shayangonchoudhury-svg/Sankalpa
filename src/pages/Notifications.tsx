import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  UserPlus,
  Eye,
  Trophy,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useNotifications } from '../hooks/useNotifications.ts';
import type { AppNotification, NotificationType } from '../types/index.ts';
import { parseTimestamp } from '../utils/dateUtils.ts';

function formatNotificationTime(timestamp: any): string {
  const d = parseTimestamp(timestamp);
  if (!d) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'checkin_due':
      return <CheckCircle2 className="w-5 h-5 text-neutral-700" />;
    case 'witness_invited':
      return <UserPlus className="w-5 h-5 text-neutral-700" />;
    case 'witness_responded':
      return <Eye className="w-5 h-5 text-neutral-700" />;
    case 'challenge_started':
      return <Trophy className="w-5 h-5 text-neutral-700" />;
    default:
      return <Bell className="w-5 h-5 text-neutral-700" />;
  }
}

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, loading, error, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.id) {
      markAsRead(notif.id);
    }

    setNavigatingId(notif.id || null);

    try {
      switch (notif.type) {
        case 'checkin_due':
          navigate(`/commitments/${notif.relatedId}`);
          break;

        case 'witness_invited':
        case 'witness_responded':
          navigate('/witness-inbox');
          break;

        case 'challenge_started': {
          // Resolve circleId from the challenge document
          try {
            const challengeSnap = await getDoc(
              doc(db, 'challenges', notif.relatedId)
            );
            if (challengeSnap.exists() && challengeSnap.data().circleId) {
              navigate(`/circles/${challengeSnap.data().circleId}`);
            } else {
              // Fallback gracefully if challenge is missing or deleted
              navigate('/circles');
            }
          } catch {
            navigate('/circles');
          }
          break;
        }

        default:
          break;
      }
    } finally {
      setNavigatingId(null);
    }
  };

  return (
    <div id="page-notifications" className="p-4 space-y-6 max-w-[480px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
        <div>
          <h1 className="font-serif text-2xl font-bold text-neutral-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Your daily reminders, circle updates, and witness activity
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            id="mark-all-read-btn"
            onClick={() => markAllAsRead()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Loading state: Calm card skeletons */}
      {loading && (
        <div id="notifications-loading-skeleton" className="space-y-2.5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-[12px] border border-neutral-200 bg-white flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-lg bg-neutral-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 bg-neutral-200 rounded w-28" />
                  <div className="h-2.5 bg-neutral-100 rounded w-12" />
                </div>
                <div className="h-2.5 bg-neutral-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error notice */}
      {error && !loading && (
        <div className="p-3.5 text-xs text-red-800 bg-red-50 border border-red-200 rounded-[12px]">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notifications.length === 0 && (
        <div
          id="notifications-empty-state"
          className="text-center py-12 px-5 bg-white border border-dashed border-neutral-200 rounded-[12px] space-y-3"
        >
          <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
            <Bell className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-base font-semibold text-neutral-900">
              You have no notifications
            </h2>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
              You're all caught up. Check-in reminders, invitations, and circle updates will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Notifications list */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-2.5" id="notifications-list">
          {notifications.map((notif) => {
            const isUnread = !notif.read;
            const isNavigating = navigatingId === notif.id;

            return (
              <div
                key={notif.id}
                id={`notification-item-${notif.id}`}
                onClick={() => handleNotificationClick(notif)}
                className={`group relative p-4 rounded-[12px] border transition-all cursor-pointer flex items-start gap-3.5 shadow-none ${
                  isUnread
                    ? 'bg-neutral-50/80 border-neutral-300 hover:border-neutral-400'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {/* Icon avatar */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isUnread ? 'bg-white border border-neutral-200' : 'bg-neutral-100'
                  }`}
                >
                  {isNavigating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                  ) : (
                    getNotificationIcon(notif.type)
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3
                      className={`text-xs tracking-tight truncate ${
                        isUnread ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <span className="text-[11px] text-neutral-400 shrink-0">
                      {formatNotificationTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.body}
                  </p>
                </div>

                {/* Unread indicator dot */}
                {isUnread && (
                  <div
                    aria-label="Unread notification"
                    className="w-2 h-2 rounded-full bg-[#3F7D5C] mt-2 shrink-0"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
