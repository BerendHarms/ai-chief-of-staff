import React from 'react';

const SOURCE_ICONS = {
  email: '📧',
  chat: '💬',
  meeting: '🤝',
  voice: '🎙️',
  decision: '⚡',
  manual: '✍️',
  system: '🔧',
};

const SOURCE_COLORS = {
  email: '#3B82F6',
  chat: '#10B981',
  meeting: '#F59E0B',
  voice: '#EC4899',
  decision: '#EF4444',
  manual: '#6B7280',
};

export default function Timeline({ events, nodes, onEventFocus }) {
  const sortedEvents = [...events].reverse(); // newest first

  if (sortedEvents.length === 0) {
    return (
      <div className="timeline-panel">
        <h3>Event Timeline</h3>
        <p className="panel-desc">No events yet. Ingest some communications to see the timeline.</p>
      </div>
    );
  }

  return (
    <div className="timeline-panel">
      <h3>Event Timeline</h3>
      <p className="panel-desc">Chronological view of all organizational events.</p>
      <div className="timeline">
        {sortedEvents.map((event, i) => {
          const icon = SOURCE_ICONS[event.source] || '📌';
          const color = SOURCE_COLORS[event.source] || '#64748b';
          const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const date = new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          // Find affected node labels
          const affectedLabels = (event.affectedNodes || [])
            .map(id => nodes.find(n => n.id === id)?.label)
            .filter(Boolean);

          return (
            <div
              key={event.id || i}
              className="timeline-item"
              role={onEventFocus ? 'button' : undefined}
              tabIndex={onEventFocus ? 0 : undefined}
              onClick={() => onEventFocus && onEventFocus(event)}
              onKeyDown={(e) => {
                if (!onEventFocus) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEventFocus(event);
                }
              }}
            >
              <div className="timeline-line">
                <div className="timeline-dot" style={{ background: color }}>{icon}</div>
                {i < sortedEvents.length - 1 && <div className="timeline-connector"></div>}
              </div>
              <div className="timeline-content">
                <div className="timeline-meta">
                  <span className="timeline-source" style={{ color }}>{event.source}</span>
                  <span className="timeline-time">{date} {time}</span>
                </div>
                <p className="timeline-summary">{event.summary}</p>
                {affectedLabels.length > 0 && (
                  <div className="timeline-tags">
                    {affectedLabels.map((label, j) => (
                      <span key={j} className="timeline-tag">{label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
