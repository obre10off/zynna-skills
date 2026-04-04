const { artifactsForRun } = require('./artifacts');
const { defaultClient } = require('./zynna-client');

function buildResult({
  runId,
  taskId,
  status,
  outputUrl = null,
  estimatedCredits = null,
  chargedCredits = null,
  creditsRefunded = false,
  raw = null,
  error = null,
}) {
  return {
    run_id: runId,
    task_id: taskId ? String(taskId) : null,
    status,
    output_url: outputUrl,
    estimated_credits: estimatedCredits,
    charged_credits: chargedCredits,
    credits_refunded: creditsRefunded,
    raw,
    error,
  };
}

function persistArtifacts(artifacts, result, title = 'Story Scenes Result') {
  artifacts.writeJson('outputs/result.json', result);
  artifacts.writeText(
    'outputs/result.md',
    [
      `# ${title}`,
      '',
      `- run_id: \`${result.run_id}\``,
      `- task_id: \`${result.task_id || '(missing)'}\``,
      `- status: \`${result.status}\``,
      `- output_url: ${result.output_url || '(missing)'}`,
      `- estimated_credits: ${result.estimated_credits == null ? '(unknown)' : result.estimated_credits}`,
      `- charged_credits: ${result.charged_credits == null ? '(unknown)' : result.charged_credits}`,
      `- credits_refunded: ${result.credits_refunded ? 'yes' : 'no'}`,
      `- error: ${result.error && result.error.message ? result.error.message : '(none)'}`,
      '',
    ].join('\n'),
  );
}

async function pollTask(client, taskId, pollInterval = 5, timeoutSec = 1800) {
  const startedAt = Date.now();
  let lastStatus = null;

  while (true) {
    if ((Date.now() - startedAt) / 1000 > timeoutSec) {
      throw new Error(`Timeout waiting for scene-builder task ${taskId}`);
    }

    const raw = await client.getSceneBuilderTaskStatus(taskId);
    const status = String(raw.status || '');
    if (status !== lastStatus) {
      console.log(JSON.stringify({ task_id: taskId, status }));
      lastStatus = status;
    }

    if (status === 'succeeded' || status === 'failed') {
      return raw;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
  }
}

async function runSceneBuilder({
  runId,
  skillDir,
  name,
  scenes,
  userId = null,
  autoGenerate = true,
  pollInterval = 5,
  timeoutSec = 1800,
  client = defaultClient(),
}) {
  const artifacts = artifactsForRun(skillDir, runId);
  artifacts.ensure();

  const requestPayload = {
    name,
    scenes,
    user_id: userId,
    auto_generate: autoGenerate,
  };
  const estimate = await client.estimateSceneBuilderTask(requestPayload);
  if (typeof estimate.estimated_credits !== 'number' || Number.isNaN(estimate.estimated_credits)) {
    throw new Error(`Estimate failed or invalid estimated_credits: ${JSON.stringify(estimate)}`);
  }

  artifacts.writeJson('input/request.json', {
    ...requestPayload,
    estimate,
  });

  const submit = await client.submitSceneBuilderTask(requestPayload);

  const taskId = submit.task_id;
  if (!taskId) {
    throw new Error(`Missing task_id in scene-builder submit: ${JSON.stringify(submit)}`);
  }

  const initial = buildResult({
    runId,
    taskId,
    status: String(submit.status || 'queued'),
    outputUrl: submit.result?.output_url || null,
    estimatedCredits: estimate.estimated_credits ?? null,
    chargedCredits: submit.credits_used ?? null,
    raw: { submit },
  });
  persistArtifacts(artifacts, initial, 'Story Scenes Submit');

  if (!autoGenerate) {
    return {
      runId,
      taskId: String(taskId),
      status: initial.status,
      outputUrl: initial.output_url,
      estimatedCredits: initial.estimated_credits,
      chargedCredits: initial.charged_credits,
      artifactsDir: artifacts.root,
    };
  }

  try {
    const raw = await pollTask(client, String(taskId), pollInterval, timeoutSec);
    const final = buildResult({
      runId,
      taskId: String(taskId),
      status: String(raw.status || ''),
      outputUrl: raw.result && typeof raw.result === 'object' ? raw.result.output_url || null : null,
      estimatedCredits: estimate.estimated_credits ?? null,
      chargedCredits: raw.credits_used ?? submit.credits_used ?? null,
      creditsRefunded: Boolean(raw.credits_refunded),
      raw: { submit, status: raw },
      error: raw.error && typeof raw.error === 'object' ? { message: raw.error.message || String(raw.error) } : null,
    });

    persistArtifacts(artifacts, final);

    return {
      runId,
      taskId: String(taskId),
      status: final.status,
      outputUrl: final.output_url,
      estimatedCredits: final.estimated_credits,
      chargedCredits: final.charged_credits,
      artifactsDir: artifacts.root,
    };
  } catch (error) {
    const failed = buildResult({
      runId,
      taskId: String(taskId),
      status: 'failed',
      estimatedCredits: estimate.estimated_credits ?? null,
      chargedCredits: submit.credits_used ?? null,
      raw: { submit },
      error: { message: error instanceof Error ? error.message : String(error) },
    });
    persistArtifacts(artifacts, failed);
    throw error;
  }
}

async function runSceneBuilderStatus({
  runId,
  skillDir,
  taskId,
  wait = false,
  pollInterval = 5,
  timeoutSec = 1800,
  client = defaultClient(),
}) {
  const artifacts = artifactsForRun(skillDir, runId);
  artifacts.ensure();

  const raw = wait
    ? await pollTask(client, String(taskId), pollInterval, timeoutSec)
    : await client.getSceneBuilderTaskStatus(String(taskId));

  const result = buildResult({
    runId,
    taskId: String(taskId),
    status: String(raw.status || ''),
    outputUrl: raw.result && typeof raw.result === 'object' ? raw.result.output_url || null : null,
    chargedCredits: raw.credits_used ?? null,
    creditsRefunded: Boolean(raw.credits_refunded),
    raw,
    error: raw.error && typeof raw.error === 'object' ? { message: raw.error.message || String(raw.error) } : null,
  });

  persistArtifacts(artifacts, result, 'Story Scenes Status');

  return {
    runId,
    taskId: String(taskId),
    status: result.status,
    outputUrl: result.output_url,
    artifactsDir: artifacts.root,
  };
}

module.exports = {
  runSceneBuilder,
  runSceneBuilderStatus,
};
