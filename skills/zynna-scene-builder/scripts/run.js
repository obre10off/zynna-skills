#!/usr/bin/env node
const path = require('node:path');
const { runSceneBuilder, runSceneBuilderStatus } = require('../lib/scene-builder');

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
    timeoutSec: 1800,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === '--wait') {
      args.wait = true;
      continue;
    }

    if (key === '--run_id') args.runId = value;
    if (key === '--task_id') args.taskId = value;
    if (key === '--name') args.name = value;
    if (key === '--user_id') args.userId = value;
    if (key === '--scenes_json') args.scenesJson = value;
    if (key === '--auto_generate') args.autoGenerate = value !== 'false';
    if (key === '--poll_interval') args.pollInterval = parsePositiveNumber('--poll_interval', value, { min: 0.1, max: 3600 });
    if (key === '--timeout_sec') args.timeoutSec = parsePositiveNumber('--timeout_sec', value, { min: 1, max: 86400 });

    if (key.startsWith('--')) {
      i += 1;
    }
  }

  return args;
}

function parseScenes(scenesJson) {
  try {
    const parsed = JSON.parse(scenesJson);
    if (!Array.isArray(parsed)) throw new Error('scenes_json must be an array');
    return parsed;
  } catch (error) {
    throw new Error(`Invalid --scenes_json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.runId || (!args.taskId && (!args.name || !args.scenesJson))) {
    console.error('Usage: run.js --run_id <run_id> (--task_id <task_id> [--wait] | --name <name> --scenes_json <json_array> [--user_id <user_id>] [--auto_generate true|false])');
    process.exit(2);
  }

  if (args.taskId) {
    const result = await runSceneBuilderStatus({
      runId: args.runId,
      skillDir: SKILL_ROOT,
      taskId: args.taskId,
      wait: Boolean(args.wait),
      pollInterval: args.pollInterval,
      timeoutSec: args.timeoutSec,
    });

    console.log(JSON.stringify({ ok: true, run_id: result.runId, task_id: result.taskId, status: result.status, output_url: result.outputUrl }));
    process.exit(result.status === 'succeeded' ? 0 : 1);
  }

  const scenes = parseScenes(args.scenesJson);
  const result = await runSceneBuilder({
    runId: args.runId,
    skillDir: SKILL_ROOT,
    name: args.name,
    scenes,
    userId: args.userId || null,
    autoGenerate: args.autoGenerate,
    pollInterval: args.pollInterval,
    timeoutSec: args.timeoutSec,
  });

  console.log(JSON.stringify({ ok: true, run_id: result.runId, task_id: result.taskId, status: result.status, output_url: result.outputUrl }));
  process.exit(result.status === 'succeeded' ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
