import React from 'react';

const AGENTS = [
  { id: 'coordinator', label: 'Coordinator', icon: '🧠', desc: 'Analyzes input & extracts intelligence' },
  { id: 'memory', label: 'Memory', icon: '💾', desc: 'Updates knowledge graph' },
  { id: 'critic', label: 'Critic', icon: '⚖️', desc: 'Checks for conflicts' },
  { id: 'router', label: 'Router', icon: '📨', desc: 'Routes notifications' },
  { id: 'summary', label: 'Summary', icon: '📝', desc: 'Generates summary' },
];

export default function AgentPipeline({ steps, reasoning }) {
  if (!steps || steps.length === 0) return null;

  // Build maps from steps (latest status per agent)
  const statusMap = {};
  const messageMap = {};
  const detailMap = {};
  const dataMap = {};
  for (const step of steps) {
    statusMap[step.agent] = step.status;
    messageMap[step.agent] = step.message;
    if (step.detail) detailMap[step.agent] = step.detail;
    if (step.data) dataMap[step.agent] = step.data;
  }

  const isComplete = AGENTS.every(a => statusMap[a.id] === 'complete');
  const hasError = Object.values(statusMap).some(s => s === 'error');
  const reasoningText = reasoning || messageMap['reasoning'] || null;

  // Count completed
  const completedCount = AGENTS.filter(a => statusMap[a.id] === 'complete').length;
  const progressPct = Math.round((completedCount / AGENTS.length) * 100);

  return (
    <div className="agent-pipeline">
      {/* Header with progress */}
      <div className="pipeline-header">
        <span className="pipeline-title">
          {hasError ? 'Processing Error' : isComplete ? 'AI Pipeline Complete' : 'AI Agents Processing'}
        </span>
        <span className="pipeline-progress-label">
          {isComplete ? '5/5' : `${completedCount}/${AGENTS.length}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="pipeline-progress-bar">
        <div
          className={`pipeline-progress-fill ${isComplete ? 'complete' : ''} ${hasError ? 'error' : ''}`}
          style={{ width: `${isComplete ? 100 : progressPct}%` }}
        />
      </div>

      {/* Agent step list */}
      <div className="pipeline-steps">
        {AGENTS.map((agent) => {
          const status = statusMap[agent.id] || 'pending';
          const message = messageMap[agent.id];
          const detail = detailMap[agent.id];
          const data = dataMap[agent.id];
          const isActive = status === 'active';
          const isDone = status === 'complete';
          const isErr = status === 'error';
          const isPending = status === 'pending';

          return (
            <div key={agent.id} className={`pipeline-agent-row ${status}`}>
              {/* Status indicator */}
              <div className="agent-status-col">
                {isActive && <div className="agent-spinner" />}
                {isDone && <span className="agent-check">✓</span>}
                {isErr && <span className="agent-check err">✗</span>}
                {isPending && <span className="agent-pending-dot" />}
              </div>

              {/* Agent info */}
              <div className="agent-info-col">
                <div className="agent-name-row">
                  <span className="agent-icon">{agent.icon}</span>
                  <span className={`agent-name ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                    {agent.label}
                  </span>
                  {isPending && <span className="agent-desc">{agent.desc}</span>}
                  {isDone && message && <span className="agent-result">{message}</span>}
                  {isErr && message && <span className="agent-result err">{message}</span>}
                </div>

                {/* Active state: show live message + detail */}
                {isActive && (
                  <div className="agent-active-body">
                    <span className="agent-active-msg">{message || agent.desc}</span>
                    {detail && <span className="agent-active-detail">{detail}</span>}
                  </div>
                )}

                {/* Completed: show detail line if available */}
                {isDone && detail && (
                  <div className="agent-done-detail">{detail}</div>
                )}

                {/* Conflict highlight */}
                {isDone && data?.hasConflicts && (
                  <div className="agent-alert">Conflicts require attention</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Reasoning — only after all agents finish */}
      {isComplete && reasoningText && (
        <div className="pipeline-reasoning">
          <div className="reasoning-header">
            <span className="reasoning-icon">💡</span>
            <span className="reasoning-title">AI Reasoning</span>
          </div>
          <p className="reasoning-text">{reasoningText}</p>
        </div>
      )}
    </div>
  );
}
