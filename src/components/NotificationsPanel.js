import React, { useState, useEffect, useCallback } from 'react';

const URGENCY_CONFIG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'URGENT', icon: '🔴' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'MEDIUM', icon: '🟡' },
  low:    { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', label: 'LOW', icon: '🔵' },
};

export default function NotificationsPanel({ apiUrl, onFocusNode }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, high, medium, low

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/notifications?limit=50`);
      const data = await res.json();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    await fetch(`${apiUrl}/api/notifications/read-all`, { method: 'POST' });
    fetchNotifications();
  };

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.urgency === filter);
  const sorted = [...filtered].reverse(); // newest first

  const unreadCount = notifications.filter(n => !n.read).length;

  // Group by target
  const grouped = {};
  for (const n of sorted) {
    const key = n.targetLabel || n.targetId || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  }

  if (loading) {
    return (
      <div className="notifications-panel">
        <h3>Notifications</h3>
        <p className="panel-desc">Loading...</p>
      </div>
    );
  }

  return (
    <div className="notifications-panel">
      <div className="notif-header">
        <h3>Notifications</h3>
        {unreadCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      <p className="panel-desc">
        The Router Agent determined who needs to know what. {notifications.length} notification(s) routed.
      </p>

      {/* Urgency filter */}
      <div className="notif-filters">
        {['all', 'high', 'medium', 'low'].map(f => (
          <button
            key={f}
            className={`notif-filter ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `All (${notifications.length})` : `${URGENCY_CONFIG[f]?.icon} ${f} (${notifications.filter(n => n.urgency === f).length})`}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="no-conflicts">
          <span className="no-conflicts-icon">📭</span>
          <p>No notifications yet. Ingest communications and the Router Agent will route them.</p>
        </div>
      ) : (
        <div className="notif-groups">
          {Object.entries(grouped).map(([targetLabel, notifs]) => (
            <div key={targetLabel} className="notif-group">
              <div className="notif-group-header" onClick={() => {
                if (onFocusNode && notifs[0]?.targetId) onFocusNode(notifs[0].targetId);
              }}>
                <span className="notif-target-icon">{notifs[0]?.targetType === 'team' ? '👥' : '👤'}</span>
                <span className="notif-target-name">{targetLabel}</span>
                <span className="notif-count">{notifs.length}</span>
              </div>
              <div className="notif-items">
                {notifs.map((n, i) => {
                  const urg = URGENCY_CONFIG[n.urgency] || URGENCY_CONFIG.medium;
                  return (
                    <div key={n.id || i} className={`notif-item ${n.read ? 'read' : 'unread'}`}>
                      <span className="notif-urgency-dot" style={{ background: urg.color }} title={urg.label} />
                      <span className="notif-message">{n.message}</span>
                      <span className="notif-time">
                        {new Date(n.timestamp || n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
