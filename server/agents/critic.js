// Critic Agent — detects contradictions, overload, and information conflicts
// The organizational immune system

import graph from '../store/knowledgeGraph.js';

export async function checkConflicts(analysis, currentGraph) {
  const conflicts = [];

  // 1. Check for explicitly flagged conflicts from the coordinator
  if (analysis.conflicts && analysis.conflicts.length > 0) {
    for (const conflict of analysis.conflicts) {
      const recorded = graph.addConflict({
        type: 'contradiction',
        description: conflict.description,
        severity: conflict.severity,
        nodeIds: conflict.involvedEntities || []
      });
      conflicts.push(recorded);
    }
  }

  // 2. Check for decision conflicts — same topic, different decisions
  const decisions = currentGraph.nodes.filter(n => n.type === 'decision');
  if (analysis.entities) {
    for (const newEntity of analysis.entities) {
      if (newEntity.type === 'decision') {
        for (const existing of decisions) {
          // Check if decisions are about the same topic but differ
          if (existing.details?.topic && newEntity.details?.topic &&
              existing.details.topic.toLowerCase() === newEntity.details.topic.toLowerCase() &&
              existing.label !== newEntity.label) {
            const recorded = graph.addConflict({
              type: 'decision_conflict',
              description: `Conflicting decisions about "${existing.details.topic}": "${existing.label}" vs "${newEntity.label}"`,
              severity: 'high',
              nodeIds: [existing.id, newEntity.id]
            });
            conflicts.push(recorded);
          }
        }
      }
    }
  }

  // 3. Check for information overload — too many notifications to one person
  if (analysis.notifications) {
    const notifCounts = {};
    for (const notif of analysis.notifications) {
      notifCounts[notif.targetEntity] = (notifCounts[notif.targetEntity] || 0) + 1;
    }
    for (const [entityId, count] of Object.entries(notifCounts)) {
      if (count > 3) {
        const node = graph.getNode(entityId);
        const recorded = graph.addConflict({
          type: 'overload',
          description: `${node?.label || entityId} is receiving ${count} notifications from a single event — potential overload`,
          severity: 'medium',
          nodeIds: [entityId]
        });
        conflicts.push(recorded);
      }
    }
  }

  if (conflicts.length > 0) {
    console.log(`⚠️  Critic: Detected ${conflicts.length} conflicts`);
  } else {
    console.log(`✅ Critic: No conflicts detected`);
  }

  return { conflicts };
}

export default { checkConflicts };
