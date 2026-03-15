const { artifactsForRun } = require('./artifacts');
const { defaultClient } = require('./zynna-client');

function buildResult({ runId, taskId, status, outputUrl = null, raw = null, error = null }) {
  return {
    run_id: runId,
    task_id: taskId ? String(taskId) : null,
    status,
    output_url: outputUrl,
    raw,
    error,
  };
}

function persistArtifacts(artifacts, result, title = 'Scene Builder Result') {
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

  artifacts.writeJson('input/request.json', {
    name,
    scenes,
    user_id: userId,
    auto_generate: autoGenerate,
  });

  const submit = await client.submitSceneBuilderTask({
    name,
    scenes,
    user_id: userId,
    auto_generate: autoGenerate,
  });

  const taskId = submit.task_id;
  if (!taskId) {
    throw new Error(`Missing task_id in scene-builder submit: ${JSON.stringify(submit)}`);
  }

  const initial = buildResult({
    runId,
    taskId,
    status: String(submit.status || 'queued'),
    outputUrl: submit.result?.output_url || null,
    raw: { submit },
  });
  persistArtifacts(artifacts, initial, 'Scene Builder Submit');

  if (!autoGenerate) {
    return {
      runId,
      taskId: String(taskId),
      status: initial.status,
      outputUrl: initial.output_url,
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
      raw: { submit, status: raw },
      error: raw.error && typeof raw.error === 'object' ? { message: raw.error.message || String(raw.error) } : null,
    });

    persistArtifacts(artifacts, final);

    return {
      runId,
      taskId: String(taskId),
      status: final.status,
      outputUrl: final.output_url,
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
    raw,
    error: raw.error && typeof raw.error === 'object' ? { message: raw.error.message || String(raw.error) } : null,
  });

  persistArtifacts(artifacts, result, 'Scene Builder Status');

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
