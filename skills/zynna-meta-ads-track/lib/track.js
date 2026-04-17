const { MetaAdsClient, validateDateRange } = require('./meta-client');
const { writeMetrics, computeSummary, normalizeResult, readLastRun, writeLastRun } = require('./artifacts');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(client, url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await client.requestJson(url, { timeoutSec: 120 });
    } catch (err) {
      const isRateLimit = err.message && err.message.includes('Too many calls');
      if (isRateLimit && attempt < retries) {
        console.error(`[warn] Rate limited. Waiting 60s before retry (${attempt + 1}/${retries})...`);
        await sleep(60 * 1000);
      } else {
        throw err;
      }
    }
  }
}

async function findCampaignId(client, targetName) {
  const data = await client.listCampaigns();
  const campaigns = data.data || [];

  if (!targetName) return null;

  const exact = campaigns.find(
    (c) => c.name.toLowerCase() === targetName.toLowerCase()
  );
  if (exact) return exact.id;

  const partial = campaigns.filter(
    (c) => c.name.toLowerCase().includes(targetName.toLowerCase())
  );

  if (partial.length === 1) return partial[0].id;
  if (partial.length > 1) {
    console.error(`[warn] Ambiguous campaign name "${targetName}". Options:`);
    partial.forEach((c) => console.error(`  - ${c.name} (${c.id})`));
    throw new Error(`Ambiguous campaign name. Specify one of: ${partial.map((c) => c.name).join(', ')}`);
  }

  throw new Error(`Campaign "${targetName}" not found. Available: ${campaigns.map((c) => c.name).join(', ')}`);
}

async function runTrack({ runId, skillDir, targetName, level = 'campaign', dateSince, dateUntil, autoRetry = true }) {
  const client = new MetaAdsClient(require('./meta-client').getMetaConfig());

  // Check for recovery
  const lastRun = readLastRun(skillDir);
  if (lastRun && lastRun.run_id === runId && lastRun.status === 'succeeded') {
    console.error(`[info] Run ${runId} already succeeded. Skipping.`);
    return lastRun;
  }

  // Validate and adjust date range
  const dateRange = validateDateRange(dateSince, dateUntil);

  // Find campaign ID if target name provided
  let campaignId = null;
  if (targetName) {
    campaignId = await findCampaignId(client, targetName);
    console.error(`[info] Campaign "${targetName}" → ID: ${campaignId}`);
  }

  // Fetch insights
  const rawData = await client.getInsights(level, {
    since: dateRange.since,
    until: dateRange.until,
    campaignId,
  });

  const rawItems = rawData.data || [];
  if (rawItems.length === 0) {
    throw new Error(`No ad data found for ${level} in range ${dateRange.since} to ${dateRange.until}. Check your date range or campaign name.`);
  }

  const results = rawItems.map(normalizeResult);
  const summary = computeSummary(results);

  const query = {
    level,
    target_name: targetName || 'all',
    date_range: dateRange,
  };

  const { jsonPath, mdPath } = writeMetrics(skillDir, query, results, summary);

  const result = {
    run_id: runId,
    status: 'succeeded',
    level,
    query: dateRange,
    summary,
    package_path: jsonPath,
    handoff_path: mdPath,
  };

  writeLastRun(skillDir, result);
  return result;
}

module.exports = { runTrack };
