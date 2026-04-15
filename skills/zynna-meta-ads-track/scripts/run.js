#!/usr/bin/env node
const path = require('node:path');
const { runTrack } = require('../lib/track');

const SKILL_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    level: 'campaign',
    dateSince: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    })(),
    dateUntil: (() => new Date().toISOString().split('T')[0])(),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--run_id') args.runId = argv[++i];
    if (key === '--target_name') args.targetName = argv[++i];
    if (key === '--level') {
      const lvl = String(argv[++i] || '').toLowerCase();
      if (!['campaign', 'adset', 'ad'].includes(lvl)) {
        console.error('Invalid --level. Must be: campaign, adset, or ad');
        process.exit(2);
      }
      args.level = lvl;
    }
    if (key === '--date_since') args.dateSince = argv[++i];
    if (key === '--date_until') args.dateUntil = argv[++i];
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.runId) {
    console.error('Usage: run.js --run_id <id> [--target_name <name>] [--level campaign|adset|ad] [--date_since YYYY-MM-DD] [--date_until YYYY-MM-DD]');
    console.error('Requires: META_ACCESS_TOKEN and META_AD_ACCOUNT_ID env vars');
    process.exit(2);
  }

  const result = await runTrack({
    runId: args.runId,
    skillDir: SKILL_ROOT,
    targetName: args.targetName || null,
    level: args.level,
    dateSince: args.dateSince,
    dateUntil: args.dateUntil,
  });

  console.log(JSON.stringify({ ok: true, ...result }));
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
