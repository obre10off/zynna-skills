#!/usr/bin/env node
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { runSwitchActor, runSwitchActorStatus } = require('../lib/switch-actor');

const SKILL_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    aspectRatio: '9:16',
    resolution: '720p',
    pollInterval: 3,
    timeoutSec: 900,
    yes: false,
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

    const value = argv[i + 1];
    if (key === '--run_id') args.runId = value;
    if (key === '--task_id') args.taskId = value;
    if (key === '--user_id') args.userId = value;
    if (key === '--original_video_url') args.originalVideoUrl = value;
    if (key === '--actor_image_url') args.actorImageUrl = value;
    if (key === '--actor_name') args.actorName = value;
    if (key === '--prompt') args.prompt = value;
    if (key === '--aspect_ratio') args.aspectRatio = value;
    if (key === '--resolution') args.resolution = value;
    if (key === '--poll_interval') args.pollInterval = Number(value);
    if (key === '--timeout_sec') args.timeoutSec = Number(value);

    if (key.startsWith('--')) {
      i += 1;
    }
  }

  return args;
}

async function confirmRun(args) {
  console.log('About to start Switch Actor via Zynna Open Skills.');
  console.log(`- aspect_ratio: ${args.aspectRatio}`);
  console.log(`- resolution: ${args.resolution}`);
  console.log(`- actor_name: ${args.actorName || '(none)'}`);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question('Confirm to start switch-actor? (yes/no): ')).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.runId || (!args.taskId && (!args.originalVideoUrl || !args.actorImageUrl))) {
    console.error('Usage: run.js --run_id <run_id> (--task_id <task_id> [--wait] | --original_video_url <url> --actor_image_url <url> [--actor_name <name>] [--prompt <prompt>] [--aspect_ratio 9:16] [--resolution 720p] [--yes])');
    process.exit(2);
  }

  if (args.taskId) {
    const result = await runSwitchActorStatus({
      runId: args.runId,
      skillDir: SKILL_ROOT,
      taskId: args.taskId,
      wait: Boolean(args.wait),
      pollInterval: args.pollInterval,
      timeoutSec: args.timeoutSec,
    });

    console.log(JSON.stringify({ ok: true, run_id: result.runId, task_id: result.taskId, status: result.status, video_url: result.videoUrl }));
    process.exit(result.status === 'succeeded' ? 0 : 1);
  }

  if (!args.yes) {
    const confirmed = await confirmRun(args);
    if (!confirmed) {
      console.log('Canceled.');
      process.exit(2);
    }
  }

  const result = await runSwitchActor({
    runId: args.runId,
    skillDir: SKILL_ROOT,
    originalVideoUrl: args.originalVideoUrl,
    actorImageUrl: args.actorImageUrl,
    actorName: args.actorName || null,
    prompt: args.prompt || null,
    aspectRatio: args.aspectRatio,
    resolution: args.resolution,
    userId: args.userId || null,
    pollInterval: args.pollInterval,
    timeoutSec: args.timeoutSec,
  });

  console.log(JSON.stringify({ ok: true, run_id: result.runId, task_id: result.taskId, status: result.status, video_url: result.videoUrl }));
  process.exit(result.status === 'succeeded' ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
