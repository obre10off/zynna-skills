#!/usr/bin/env node
const path = require('node:path');
const { runGenerateAd } = require('../lib/generate');

const SKILL_ROOT = path.resolve(__dirname, '..');

function parsePositiveNumber(name, value, { min, max }) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new Error(`Invalid ${name}. Expected a number in range [${min}, ${max}].`);
  }
  return num;
}

function parseArgs(argv) {
  const args = {
    autoGenerate: true,
    pollInterval: 5,
    timeoutSec: 300,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--run_id') args.runId = argv[i + 1] && argv[i + 1] !== 'undefined' ? argv[++i] : undefined;
    if (key === '--product') args.product = argv[++i];
    if (key === '--audience') args.audience = argv[++i];
    if (key === '--offer') args.offer = argv[++i];
    if (key === '--destination_url') args.destinationUrl = argv[++i];
    if (key === '--auto_generate') args.autoGenerate = argv[++i] !== 'false';
    if (key === '--poll_interval') args.pollInterval = parsePositiveNumber('--poll_interval', argv[++i], { min: 0.1, max: 3600 });
    if (key === '--timeout_sec') args.timeoutSec = parsePositiveNumber('--timeout_sec', argv[++i], { min: 1, max: 86400 });
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.runId || !args.product || !args.audience || !args.offer || !args.destinationUrl) {
    console.error('Usage: run.js --run_id <id> --product <name> --audience <desc> --offer <value_prop> --destination_url <url> [--auto_generate true|false] [--poll_interval <sec>] [--timeout_sec <sec>]');
    process.exit(2);
  }

  const result = await runGenerateAd({
    runId: args.runId,
    skillDir: SKILL_ROOT,
    product: args.product,
    audience: args.audience,
    offer: args.offer,
    destinationUrl: args.destinationUrl,
    autoGenerate: args.autoGenerate,
    pollInterval: args.pollInterval,
    timeoutSec: args.timeoutSec,
  });

  console.log(JSON.stringify({ ok: true, ...result }));
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
