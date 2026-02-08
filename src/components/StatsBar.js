import React from 'react';

export default function StatsBar({ graphData, lastEvent }) {
  const nodes = graphData.nodes || [];
  const edges = graphData.edges || [];
  const events = graphData.events || [];
  const conflicts = (graphData.conflicts || []).filter(c => c.status === 'open');

  const stats = [
    { label: 'People', value: nodes.filter(n => n.type === 'person').length },
    { label: 'Teams', value: nodes.filter(n => n.type === 'team').length },
    { label: 'Projects', value: nodes.filter(n => n.type === 'project').length },
    { label: 'Decisions', value: nodes.filter(n => n.type === 'decision').length },
    { label: 'Connections', value: edges.length },
    { label: 'Events', value: events.length },
    { label: 'Conflicts', value: conflicts.length },
  ];

  return (
    <div className="stats-bar">
      {stats.map(s => (
        <div key={s.label} className="stat-item">
          <span className="stat-value">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
      {lastEvent && (
        <div className="last-event">
          <span className="last-event-label">Latest:</span>
          <span className="last-event-text">{lastEvent.summary?.substring(0, 80)}...</span>
        </div>
      )}
    </div>
  );
}
