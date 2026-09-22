import React from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications.ts';

export const NotificationBadge: React.FC = () => {
  const { unreadCount } = useNotifications();

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <Link
      to="/notifications"
      id="header-notification-badge"
      aria-label={`Notifications (${unreadCount} unread)`}
      className="relative p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors flex items-center justify-center"
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span
          id="header-notification-count"
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-neutral-900 text-white text-[10px] font-medium rounded-full flex items-center justify-center leading-none"
        >
          {displayCount}
        </span>
      )}
    </Link>
  );
};
