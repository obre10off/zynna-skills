const fs = require('node:fs');
const path = require('node:path');

function ensureOutputs(skillDir) {
  const outDir = path.join(skillDir, 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  return outDir;
}

function extractAction(actions, type) {
  if (!Array.isArray(actions)) return null;
  const found = actions.find((a) => a.action_type === type || a.action_type === `offsite_conversion.fb_pixel_${type}`);
  return found ? parseInt(found.value, 10) || null : null;
}

function normalizeResult(raw) {
  return {
    id: raw.id || raw.campaign_id || 'unknown',
    name: raw.name || raw.campaign_name || raw.adset_name || raw.ad_name || 'Unknown',
    impressions: parseInt(raw.impressions || 0, 10),
    reach: parseInt(raw.reach || 0, 10),
    spend: parseFloat(raw.spend || 0),
    clicks: parseInt(raw.clicks || 0, 10),
    ctr: parseFloat(raw.ctr || 0),
    cpc: parseFloat(raw.cpc || 0),
    cpm: parseFloat(raw.cpm || 0),
    cpa: null,
    actions: {
      purchase: extractAction(raw.actions, 'purchase'),
      lead: extractAction(raw.actions, 'lead'),
      page_view: extractAction(raw.actions, 'page_view'),
    },
  };
}

function computeSummary(results) {
  const totalSpend = results.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = results.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = results.reduce((s, r) => s + r.clicks, 0);
  const purchases = results.reduce((s, r) => s + (r.actions.purchase || 0), 0);

  return {
    total_spend: Math.round(totalSpend * 100) / 100,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    avg_ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
    avg_cpm: totalImpressions > 0 ? Math.round((totalSpend / totalImpressions) * 1000) : 0,
    total_purchases: purchases,
    cpa: purchases > 0 ? Math.round((totalSpend / purchases) * 100) / 100 : null,
  };
}

function writeMetrics(skillDir, query, results, summary) {
  const outDir = ensureOutputs(skillDir);
  const jsonPath = path.join(outDir, 'metrics.json');
  const mdPath = path.join(outDir, 'metrics.md');

  const payload = {
    version: '1.0',
    query,
    results,
    summary,
    fetched_at: new Date().toISOString(),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const rows = results.map((r) =>
    `| ${r.name} | ${r.impressions.toLocaleString()} | $${r.spend.toFixed(2)} | ${r.clicks.toLocaleString()} | ${r.ctr.toFixed(2)}% | ${r.cpc.toFixed(2)} | ${r.cpm.toFixed(2)} | ${r.actions.purchase ?? '-'} |`
  ).join('\n');

  const lines = [
    '# Meta Ads Performance',
    '',
    `**Date range:** ${query.date_range.since} → ${query.date_range.until}`,
    `**Level:** ${query.level}`,
    `**Fetched:** ${payload.fetched_at}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Spend | $${summary.total_spend.toFixed(2)} |`,
    `| Total Impressions | ${summary.total_impressions.toLocaleString()} |`,
    `| Total Clicks | ${summary.total_clicks.toLocaleString()} |`,
    `| Avg CTR | ${summary.avg_ctr}% |`,
    `| Avg CPM | $${summary.avg_cpm.toFixed(2)} |`,
    `| Total Purchases | ${summary.total_purchases} |`,
    `| CPA | ${summary.cpa !== null ? '$' + summary.cpa.toFixed(2) : 'N/A'} |`,
    '',
    '## Breakdown',
    '',
    '| Name | Impressions | Spend | Clicks | CTR | CPC | CPM | Purchases |',
    '|------|------------|-------|--------|-----|-----|-----|-----------|',
    ...rows,
  ];

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
  return { jsonPath, mdPath };
}

function readLastRun(skillDir) {
  const lastRunPath = path.join(skillDir, 'outputs', 'last_run.json');
  if (!fs.existsSync(lastRunPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(lastRunPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeLastRun(skillDir, runData) {
  const outDir = ensureOutputs(skillDir);
  const lastRunPath = path.join(outDir, 'last_run.json');
  fs.writeFileSync(lastRunPath, JSON.stringify(runData, null, 2), 'utf8');
}

module.exports = {
  writeMetrics,
  computeSummary,
  normalizeResult,
  readLastRun,
  writeLastRun,
};
