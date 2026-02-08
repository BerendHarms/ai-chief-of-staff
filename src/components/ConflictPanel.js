import React, { useState } from 'react';

const SEVERITY_CONFIG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'HIGH' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'MEDIUM' },
  low:    { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', label: 'LOW' },
};

export default function ConflictPanel({ conflicts, apiUrl }) {
  const [resolvingId, setResolvingId] = useState(null);
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleResolve = async (conflictId) => {
    if (!resolution.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${apiUrl}/api/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      });
      setResolvingId(null);
      setResolution('');
    } catch (e) {
      console.error('Failed to resolve:', e);
    }
    setSubmitting(false);
  };

  if (conflicts.length === 0) {
    return (
      <div className="conflict-panel">
        <h3>Conflict Detection</h3>
        <div className="no-conflicts">
          <span className="no-conflicts-icon">&#x2705;</span>
          <p>No open conflicts detected. The organizational knowledge is consistent.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-panel">
      <h3>Conflict Detection</h3>
      <p className="panel-desc">The Critic Agent has flagged these contradictions or issues.</p>

      <div className="conflicts-list">
        {conflicts.map(conflict => {
          const sev = SEVERITY_CONFIG[conflict.severity] || SEVERITY_CONFIG.medium;
          const isResolving = resolvingId === conflict.id;
          return (
            <div key={conflict.id} className="conflict-card" style={{ borderLeftColor: sev.color }}>
              <div className="conflict-header">
                <span className="severity-badge" style={{ background: sev.bg, color: sev.color }}>
                  {sev.label}
                </span>
                <span className="conflict-type">{conflict.type?.replace(/_/g, ' ')}</span>
                <span className="conflict-time">
                  {new Date(conflict.detectedAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="conflict-desc">{conflict.description}</p>

              {!isResolving ? (
                <button className="btn btn-resolve" onClick={() => { setResolvingId(conflict.id); setResolution(''); }}>
                  Mark Resolved
                </button>
              ) : (
                <div className="resolve-form">
                  <textarea
                    className="resolve-input"
                    placeholder="How was this conflict resolved? (e.g., 'CEO confirmed April 15 as the new launch date')"
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="resolve-actions">
                    <button
                      className="btn btn-confirm-resolve"
                      onClick={() => handleResolve(conflict.id)}
                      disabled={!resolution.trim() || submitting}
                    >
                      {submitting ? 'Resolving...' : 'Confirm Resolution'}
                    </button>
                    <button
                      className="btn btn-cancel-resolve"
                      onClick={() => { setResolvingId(null); setResolution(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
