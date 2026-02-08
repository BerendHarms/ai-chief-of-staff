// Memory Agent — maintains and updates the organizational knowledge graph
// Responsible for adding/updating entities and relationships

import graph from '../store/knowledgeGraph.js';

export async function updateGraph(entities = [], relationships = []) {
  const nodeIds = [];
  const edgeIds = [];

  // Add/update entities
  for (const entity of entities) {
    // Normalize the ID: use existing node if label matches
    const existing = graph.getFullGraph().nodes.find(
      n => n.label.toLowerCase() === entity.label.toLowerCase() && n.type === entity.type
    );

    const id = existing ? existing.id : entity.id || entity.label.toLowerCase().replace(/\s+/g, '-');

    const nodeId = graph.addNode({
      id,
      type: entity.type,
      label: entity.label,
      details: { ...existing?.details, ...entity.details }
    });
    nodeIds.push(nodeId);
  }

  // Add/update relationships
  for (const rel of relationships) {
    // Resolve entity references
    const fromId = resolveEntityId(rel.from);
    const toId = resolveEntityId(rel.to);

    if (fromId && toId) {
      const edgeId = graph.addEdge({
        from: fromId,
        to: toId,
        type: rel.type,
        label: rel.label || rel.type
      });
      edgeIds.push(edgeId);
    }
  }

  console.log(`💾 Memory: Updated ${nodeIds.length} nodes, ${edgeIds.length} edges`);
  return { nodeIds, edgeIds };
}

function resolveEntityId(ref) {
  if (!ref) return null;
  const nodes = graph.getFullGraph().nodes;
  // Try direct ID match
  const byId = nodes.find(n => n.id === ref);
  if (byId) return byId.id;
  // Try label match
  const byLabel = nodes.find(n => n.label.toLowerCase() === ref.toLowerCase());
  if (byLabel) return byLabel.id;
  // Try normalized ref as ID
  return ref.toLowerCase().replace(/\s+/g, '-');
}

export default { updateGraph };
