// Router Agent — decides who needs to know what
// The organizational information router

import graph from '../store/knowledgeGraph.js';

export async function routeNotifications(notifications = [], currentGraph) {
  const routedNotifications = [];

  for (const notif of notifications) {
    // Find the target entity
    const target = currentGraph.nodes.find(n =>
      n.id === notif.targetEntity ||
      n.label.toLowerCase() === notif.targetEntity?.toLowerCase()
    );

    if (target) {
      const entry = {
        targetId: target.id,
        targetLabel: target.label,
        targetType: target.type,
        message: notif.message,
        urgency: notif.urgency || 'medium',
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      routedNotifications.push(entry);
      // Persist to graph store
      graph.addNotification(entry);

      // Also notify the team if the person belongs to one
      const teamEdges = graph.getEdgesForNode(target.id)
        .filter(e => e.type === 'belongs_to' || e.type === 'reports_to');

      for (const edge of teamEdges) {
        const teamNode = graph.getNode(edge.to);
        if (teamNode && teamNode.type === 'team') {
          const teamEntry = {
            targetId: teamNode.id,
            targetLabel: teamNode.label,
            targetType: 'team',
            message: `Team update: ${notif.message}`,
            urgency: notif.urgency === 'high' ? 'medium' : 'low',
            timestamp: new Date().toISOString(),
            status: 'pending',
            cascadedFrom: target.id
          };
          routedNotifications.push(teamEntry);
          graph.addNotification(teamEntry);
        }
      }
    }
  }

  console.log(`📨 Router: ${routedNotifications.length} notifications queued`);
  return { notifications: routedNotifications };
}

export default { routeNotifications };
