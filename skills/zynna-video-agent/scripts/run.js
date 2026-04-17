#!/usr/bin/env node
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { runVideoAgent, runVideoAgentStatus } = require('../lib/video-agent');

const SKILL_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    model: 'veo-3.1',
    ratio: '9:16',
    duration: '5',
    sound: false,
    timeoutSec: 900,
    pollInterval: 3,
    yes: false,
    wait: false,
    estimateOnly: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--yes') {
      args.yes = true;
      continue;
    }
    if (key === '--wait') {
      args.wait = true;
      continue;
    }
    if (key === '--estimate_only') {
      args.estimateOnly = true;
      continue;
    }
    if (key === '--sound') {
      args.sound = true;
      continue;
    }

    const value = argv[i + 1];
    if (key === '--prompt') args.prompt = value;
    if (key === '--pipeline_id') args.pipelineId = value;
    if (key === '--model') args.model = value;
    if (key === '--ratio') args.ratio = value;
    if (key === '--duration') args.duration = value;
    if (key === '--run_id') args.runId = value;
    if (key === '--task_id') args.taskId = value;
    if (key === '--timeout_sec') args.timeoutSec = Number(value);
    if (key === '--poll_interval') args.pollInterval = Number(value);
    if (key === '--image_urls_json') args.imageUrlsJson = value;
    if (key.startsWith('--')) {
      i += 1;
    }
  }

  return args;
}

async function confirmExecution(args) {
  console.log('About to run zynna-video-agent.');
  console.log(`- pipeline_id: ${args.pipelineId}`);
  console.log(`- model: ${args.model}`);
  console.log(`- ratio: ${args.ratio}`);
  console.log(`- duration: ${args.duration}`);
  console.log(`- prompt (first 120 chars): ${String(args.prompt).slice(0, 120)}`);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question('Confirm to start generation? (yes/no): ')).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

function parseImageUrls(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string');
  } catch {}
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.runId || (!args.prompt && !args.taskId)) {
    console.error('Usage: run.js --run_id <run_id> (--prompt <prompt> --pipeline_id <pipeline_id> [--model veo-3.1] [--ratio 9:16] [--duration 5] [--sound] [--image_urls_json \"[\\\"https://...\\\"]\"] [--estimate_only] [--yes] | --task_id <task_id> [--wait])');
    process.exit(2);
  }

  if (args.taskId) {
    const result = await runVideoAgentStatus({
      runId: args.runId,
      taskId: args.taskId,
      pipelineId: args.pipelineId || null,
      skillDir: SKILL_ROOT,
      wait: Boolean(args.wait),
      timeoutSec: args.timeoutSec,
      pollInterval: args.pollInterval,
    });
    console.log(JSON.stringify({ ok: true, run_id: result.runId, task_id: result.taskId, status: result.status, video_url: result.videoUrl }));
    process.exit(result.status === 'succeeded' ? 0 : 1);
  }

  if (!args.pipelineId) {
    console.error('--pipeline_id is required when submitting a new task');
    process.exit(2);
  }

  if (!args.yes) {
    const confirmed = await confirmExecution(args);
    if (!confirmed) {
      console.log('Canceled.');
      process.exit(2);
    }
  }

  const result = await runVideoAgent({
    runId: args.runId,
    skillDir: SKILL_ROOT,
    prompt: args.prompt,
    pipelineId: args.pipelineId,
    model: args.model,
    ratio: args.ratio,
    duration: args.duration,
    sound: args.sound,
    imageUrls: parseImageUrls(args.imageUrlsJson),
    estimateOnly: Boolean(args.estimateOnly),
    timeoutSec: args.timeoutSec,
    pollInterval: args.pollInterval,
  });

  console.log(JSON.stringify({
    ok: true,
    run_id: result.runId,
    task_id: result.taskId,
    status: result.status,
    video_url: result.videoUrl || null,
    estimated_credits: result.estimatedCredits || null,
  }));
  process.exit(result.status === 'succeeded' || result.status === 'estimated' ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

