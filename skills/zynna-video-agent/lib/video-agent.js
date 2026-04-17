const { artifactsForRun } = require('./artifacts');
const { defaultClient } = require('./zynna-client');

function buildResult({
  runId,
  taskId,
  status,
  stage,
  pipelineId,
  model = null,
  videoUrl = null,
  estimatedCredits = null,
  raw = null,
  error = null,
}) {
  return {
    run_id: runId,
    task_id: taskId ? String(taskId) : null,
    status,
    stage,
    pipeline_id: pipelineId || null,
    model,
    video_url: videoUrl,
    estimated_credits: estimatedCredits,
    raw,
    error,
  };
}

function persistArtifacts(artifacts, result, title = 'Video Agent Result') {
  artifacts.writeJson('outputs/result.json', result);
  artifacts.writeText(
    'outputs/result.md',
    [
      `# ${title}`,
      '',
      `- run_id: \`${result.run_id}\``,
      `- status: \`${result.status}\``,
      `- stage: \`${result.stage || '(unknown)'}\``,
      `- pipeline_id: \`${result.pipeline_id || '(unknown)'}\``,
      `- model: \`${result.model || '(unknown)'}\``,
      `- task_id: \`${result.task_id || '(missing)'}\``,
      `- video_url: ${result.video_url || '(missing)'}`,
      `- estimated_credits: ${result.estimated_credits ?? '(unknown)'}`,
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
      throw new Error(`Timeout waiting for task ${taskId}`);
    }

    const statusPayload = await client.getTaskStatus(taskId);
    const status = String(statusPayload.status || '');
    if (status !== lastStatus) {
      console.log(JSON.stringify({ task_id: taskId, status, stage: statusPayload.stage || null }));
      lastStatus = status;
    }

    if (status === 'succeeded' || status === 'failed') {
      return statusPayload;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
  }
}

async function runVideoAgentStatus({
  runId,
  taskId,
  pipelineId = null,
  skillDir,
  wait = false,
  pollInterval = 3,
  timeoutSec = 900,
  client = defaultClient(),
}) {
  const artifacts = artifactsForRun(skillDir, runId);
  artifacts.ensure();

  const raw = wait
    ? await pollTask(client, String(taskId), pollInterval, timeoutSec)
    : await client.getTaskStatus(String(taskId));

  const result = buildResult({
    runId,
    taskId: String(taskId),
    status: String(raw.status || ''),
    stage: raw.stage || null,
    pipelineId: pipelineId || null,
    model: raw.model || null,
    videoUrl: raw.result?.video_url || null,
    estimatedCredits: null,
    raw,
    error: raw.error && typeof raw.error === 'object'
      ? { message: raw.error.message || String(raw.error) }
      : null,
  });

  persistArtifacts(artifacts, result, 'Video Agent Task Status');

  return {
    runId,
    artifactsDir: artifacts.root,
    taskId: String(taskId),
    status: result.status,
    videoUrl: result.video_url,
    raw,
  };
}

async function runVideoAgent({
  runId,
  skillDir,
  prompt,
  pipelineId,
  model = 'veo-3.1',
  ratio = '9:16',
  duration = '5',
  sound = false,
  imageUrls = null,
  estimateOnly = false,
  pollInterval = 3,
  timeoutSec = 900,
  client = defaultClient(),
}) {
  const artifacts = artifactsForRun(skillDir, runId);
  artifacts.ensure();

  const payload = {
    prompt,
    pipeline_id: pipelineId,
    model,
    ratio,
    duration,
    sound,
    ...(Array.isArray(imageUrls) && imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
  };

  artifacts.writeJson('input/request.json', payload);

  if (estimateOnly) {
    const estimate = await client.estimateTask(payload);
    const result = buildResult({
      runId,
      taskId: null,
      status: 'estimated',
      stage: 'proposal',
      pipelineId,
      model,
      estimatedCredits: estimate.estimated_credits ?? null,
      raw: estimate,
    });
    persistArtifacts(artifacts, result, 'Video Agent Estimate');
    return {
      runId,
      artifactsDir: artifacts.root,
      taskId: null,
      status: 'estimated',
      estimatedCredits: estimate.estimated_credits ?? null,
      raw: estimate,
    };
  }

  const submit = await client.submitTask(payload);
  const taskId = submit.task_id;
  if (!taskId) {
    throw new Error(`Missing task_id in response: ${JSON.stringify(submit)}`);
  }

  const initial = buildResult({
    runId,
    taskId: String(taskId),
    status: String(submit.status || 'queued'),
    stage: submit.stage || 'assets',
    pipelineId: submit.pipeline_id || pipelineId,
    model: submit.model || model,
    estimatedCredits: submit.estimated_credits ?? null,
    raw: { submit },
  });
  persistArtifacts(artifacts, initial, 'Video Agent Submission');

  const raw = await pollTask(client, String(taskId), pollInterval, timeoutSec);
  const result = buildResult({
    runId,
    taskId: String(taskId),
    status: String(raw.status || ''),
    stage: raw.stage || null,
    pipelineId: submit.pipeline_id || pipelineId,
    model: raw.model || submit.model || model,
    videoUrl: raw.result?.video_url || null,
    estimatedCredits: submit.estimated_credits ?? null,
    raw: { submit, status: raw },
    error: raw.error && typeof raw.error === 'object'
      ? { message: raw.error.message || String(raw.error) }
      : null,
  });
  persistArtifacts(artifacts, result);

  return {
    runId,
    artifactsDir: artifacts.root,
    taskId: String(taskId),
    status: result.status,
    videoUrl: result.video_url,
    raw,
  };
}

module.exports = {
  buildResult,
  persistArtifacts,
  pollTask,
  runVideoAgent,
  runVideoAgentStatus,
};

