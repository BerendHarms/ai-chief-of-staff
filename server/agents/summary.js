// Summary Agent — generates human-readable summaries
// Translates AI analysis into clear language

export async function generateSummary(source, rawContent, analysis) {
  const entityList = (analysis.entities || []).map(e => e.label).join(', ');
  const changeList = (analysis.changes || []).map(c => c.description).join('; ');
  const conflictCount = (analysis.conflicts || []).length;

  let summary = analysis.summary || '';

  if (!summary) {
    summary = `New ${source} communication processed. `;
    if (entityList) summary += `Involves: ${entityList}. `;
    if (changeList) summary += `Changes: ${changeList}. `;
    if (conflictCount > 0) summary += `⚠️ ${conflictCount} conflict(s) detected.`;
  }

  return { summary, source, timestamp: new Date().toISOString() };
}

export default { generateSummary };
