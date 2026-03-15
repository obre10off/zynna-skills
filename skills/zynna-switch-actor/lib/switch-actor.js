const { artifactsForRun } = require('./artifacts');
const { defaultClient } = require('./zynna-client');

function buildResult({ runId, taskId, status, videoUrl = null, progress = 0, raw = null, error = null }) {
  return {
    run_id: runId,
    task_id: taskId ? String(taskId) : null,
    status,
    video_url: videoUrl,
    progress,
    raw,
    error,
  };
}

function persistArtifacts(artifacts, result, title = 'Switch Actor Result') {
  artifacts.writeJson('outputs/result.json', result);
  artifacts.writeText(
    'outputs/result.md',
    [
      `# ${title}`,
      '',
      `- run_id: \`${result.run_id}\``,
      `- task_id: \`${result.task_id || '(missing)'}\``,
      `- status: \`${result.status}\``,
      `- progress: ${result.progress}%`,
      `- video_url: ${result.video_url || '(missing)'}`,
      `- error: ${result.error && result.error.message ? result.error.message : '(none)'}`,
      '',
    ].join('\n'),
  );
}

async function pollTask(client, taskId, pollInterval = 3, timeoutSec = 900) {
  const startedAt = Date.now();
  let lastStatus = null;

  while (true) {
    if ((Date.now() - startedAt) / 1000 > timeoutSec) {
      throw new Error(`Timeout waiting for switch-actor task ${taskId}`);
    }

    const raw = await client.getSwitchActorTaskStatus(taskId);
    const status = String(raw.status || '');
    if (status !== lastStatus) {
      console.log(JSON.stringify({ task_id: taskId, status, progress: raw.progress || 0 }));
      lastStatus = status;
    }

    if (status === 'succeeded' || status === 'failed') {
      return raw;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
  }
}

async function runSwitchActor({
  runId,
  skillDir,
  originalVideoUrl,
  actorImageUrl,
  actorName = null,
  prompt = null,
  aspectRatio = '9:16',
  resolution = '720p',
  userId = null,
  pollInterval = 3,
  timeoutSec = 900,
  client = defaultClient(),
}) {
  const artifacts = artifactsForRun(skillDir, runId);
  artifacts.ensure();

  const requestPayload = {
    original_video_url: originalVideoUrl,
    actor_image_url: actorImageUrl,
    actor_name: actorName,
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    user_id: userId,
  };

  artifacts.writeJson('input/request.json', requestPayload);

  const submit = await client.submitSwitchActorTask(requestPayload);
  const taskId = submit.task_id;
  if (!taskId) {
    throw new Error(`Missing task_id in switch-actor submit: ${JSON.stringify(submit)}`);
  }

  const initial = buildResult({
    runId,
    taskId,
    status: String(submit.status || 'queued'),
    raw: { submit },
  });
  persistArtifacts(artifacts, initial, 'Switch Actor Submit');

  try {
    const raw = await pollTask(client, String(taskId), pollInterval, timeoutSec);
    const final = buildResult({
      runId,
      taskId,
      status: String(raw.status || ''),
      videoUrl: raw.result && typeof raw.result === 'object' ? raw.result.video_url || null : null,
      progress: Number(raw.progress || 0),
      raw: { submit, status: raw },
      error: raw.error && typeof raw.error === 'object' ? { message: raw.error.message || String(raw.error) } : null,
    });

    persistArtifacts(artifacts, final);

    return {
      runId,
      taskId: String(taskId),
      status: final.status,
      videoUrl: final.video_url,
      artifactsDir: artifacts.root,
    };
  } catch (error) {
    const failed = buildResult({
      runId,
      taskId: String(taskId),
      status: 'failed',
      raw: { submit },
      error: { message: error instanceof Error ? error.message : String(error) },
    });

    persistArtifacts(artifacts, failed);
    throw error;
  }
}

async function runSwitchActorStatus({
  runId,
  skillDir,
  taskId,
  wait = false,
  pollInterval = 3,
  timeoutSec = 900,
  client = defaultClient(),
}) {
  const artifacts = artifactsForRun(skillDir, runId);
  artifacts.ensure();

  const raw = wait
    ? await pollTask(client, String(taskId), pollInterval, timeoutSec)
    : await client.getSwitchActorTaskStatus(String(taskId));

  const result = buildResult({
    runId,
    taskId,
    status: String(raw.status || ''),
    videoUrl: raw.result && typeof raw.result === 'object' ? raw.result.video_url || null : null,
    progress: Number(raw.progress || 0),
    raw,
    error: raw.error && typeof raw.error === 'object' ? { message: raw.error.message || String(raw.error) } : null,
  });

  persistArtifacts(artifacts, result, 'Switch Actor Status');

  return {
    runId,
    taskId: String(taskId),
    status: result.status,
    videoUrl: result.video_url,
    artifactsDir: artifacts.root,
  };
}

module.exports = {
  runSwitchActor,
  runSwitchActorStatus,
};
