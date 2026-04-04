#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const ANALYZE_SKILL_DIR = path.join(SKILLS_ROOT, 'zynna-analyze-video');
const RECREATE_SKILL_DIR = path.join(SKILLS_ROOT, 'zynna-recreate-video');
const GENERATE_SKILL_DIR = path.join(SKILLS_ROOT, 'zynna-generate-video');
const SCENE_BUILDER_SKILL_DIR = path.join(SKILLS_ROOT, 'zynna-scene-builder');
const SWITCH_ACTOR_SKILL_DIR = path.join(SKILLS_ROOT, 'zynna-switch-actor');

const { runAnalyzeVideo } = require('../zynna-analyze-video/lib/analyze-video');
const { runRecreateVideo } = require('../zynna-recreate-video/lib/recreate-video');
const { runGenerateVideo, runGenerateVideoStatus } = require('../zynna-generate-video/lib/generate-video');
const { runSceneBuilder, runSceneBuilderStatus } = require('../zynna-scene-builder/lib/scene-builder');
const { runSwitchActor, runSwitchActorStatus } = require('../zynna-switch-actor/lib/switch-actor');
const { artifactsForRun } = require('../zynna-analyze-video/lib/artifacts');
const { getZynnaConfig } = require('../zynna-analyze-video/lib/config');

class FakeClient {
  async analyze() {
    return {
      session: { id: 'sess_test' },
      video_uid: 'vid_test_1',
      video: {
        download_url: 'https://example.com/video.mp4',
        cover_url: null,
        duration_sec: 8,
      },
      transcript: {
        segments: [
          { sequence: 1, start: 0, end: 2, content: 'Hook line' },
          { sequence: 2, start: 2, end: 5, content: 'Problem-solution line' },
        ],
      },
      vision: {
        scenes: [{ sequence: 1, timestamp_sec: 1.2, title: 'Frame 1' }],
      },
      response: {
        content: 'Analysis body',
        suggestions: ['Rewrite for skincare'],
      },
    };
  }

  async submitTask() {
    return { task_id: 'task_123', status: 'queued' };
  }

  async estimateTask() {
    return { estimated_credits: 4.2, available_credits: 100 };
  }

  async getTaskStatus() {
    return {
      task_id: 'task_123',
      status: 'succeeded',
      result: {
        video_url: 'https://example.com/final.mp4',
      },
    };
  }

  async submitSceneBuilderTask() {
    return { task_id: 'scene_task_1', status: 'queued' };
  }

  async estimateSceneBuilderTask() {
    return { estimated_credits: 6.5, available_credits: 100 };
  }

  async getSceneBuilderTaskStatus() {
    return {
      task_id: 'scene_task_1',
      status: 'succeeded',
      result: {
        output_url: 'https://example.com/scene-output.mp4',
      },
    };
  }

  async submitSwitchActorTask() {
    return { task_id: 'switch_task_1', status: 'queued' };
  }

  async estimateSwitchActorTask() {
    return { estimated_credits: 8.7, available_credits: 100, source_duration_seconds: 9.2 };
  }

  async getSwitchActorTaskStatus() {
    return {
      task_id: 'switch_task_1',
      status: 'succeeded',
      progress: 100,
      result: {
        video_url: 'https://example.com/switch-output.mp4',
      },
    };
  }
}

function cleanup(paths) {
  for (const p of paths) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

test('zynna-analyze-video writes expected artifacts', async () => {
  const runDir = path.join(ANALYZE_SKILL_DIR, '.artifacts', 'smoke-analyze');
  cleanup([runDir]);

  const result = await runAnalyzeVideo({
    tiktokUrl: 'https://www.tiktok.com/@demo/video/123',
    runId: 'smoke-analyze',
    skillDir: ANALYZE_SKILL_DIR,
    client: new FakeClient(),
  });

  assert.equal(fs.existsSync(path.join(result.artifactsDir, 'outputs', 'result.json')), true);
  cleanup([runDir]);
});

test('zynna-recreate-video writes recreate_source artifact', async () => {
  const runDir = path.join(RECREATE_SKILL_DIR, '.artifacts', 'smoke-recreate');
  cleanup([runDir]);

  const result = await runRecreateVideo({
    tiktokUrl: 'https://www.tiktok.com/@demo/video/123',
    runId: 'smoke-recreate',
    skillDir: RECREATE_SKILL_DIR,
    analyzeSkillDir: ANALYZE_SKILL_DIR,
    analyzeRunner: async () => ({
      runId: 'smoke-recreate--analyze',
      artifactsDir: path.join(ANALYZE_SKILL_DIR, '.artifacts', 'smoke-recreate--analyze'),
      result: { transcript: { segments: [] } },
    }),
  });

  assert.equal(fs.existsSync(path.join(result.artifactsDir, 'outputs', 'recreate_source.json')), true);
  cleanup([runDir]);
});

test('zynna-generate-video writes result and supports status lookup', async () => {
  const runDir = path.join(GENERATE_SKILL_DIR, '.artifacts', 'smoke-generate');
  const statusRunDir = path.join(GENERATE_SKILL_DIR, '.artifacts', 'smoke-status');
  cleanup([runDir, statusRunDir]);

  const result = await runGenerateVideo({
    prompt: 'Generate a short product demo',
    runId: 'smoke-generate',
    skillDir: GENERATE_SKILL_DIR,
    client: new FakeClient(),
    pollInterval: 0.01,
    timeoutSec: 1,
  });

  assert.equal(result.status, 'succeeded');

  const statusResult = await runGenerateVideoStatus({
    taskId: 'task_123',
    runId: 'smoke-status',
    skillDir: GENERATE_SKILL_DIR,
    client: new FakeClient(),
  });

  assert.equal(statusResult.videoUrl, 'https://example.com/final.mp4');
  cleanup([runDir, statusRunDir]);
});

test('zynna-scene-builder writes result and supports status lookup', async () => {
  const runDir = path.join(SCENE_BUILDER_SKILL_DIR, '.artifacts', 'smoke-scene-builder');
  const statusRunDir = path.join(SCENE_BUILDER_SKILL_DIR, '.artifacts', 'smoke-scene-status');
  cleanup([runDir, statusRunDir]);

  const result = await runSceneBuilder({
    runId: 'smoke-scene-builder',
    skillDir: SCENE_BUILDER_SKILL_DIR,
    name: 'Smoke Scene Project',
    scenes: [{ prompt: 'Scene one', duration: 4, outputType: 'video' }],
    client: new FakeClient(),
    pollInterval: 0.01,
    timeoutSec: 1,
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.outputUrl, 'https://example.com/scene-output.mp4');

  const statusResult = await runSceneBuilderStatus({
    runId: 'smoke-scene-status',
    skillDir: SCENE_BUILDER_SKILL_DIR,
    taskId: 'scene_task_1',
    client: new FakeClient(),
  });

  assert.equal(statusResult.outputUrl, 'https://example.com/scene-output.mp4');
  cleanup([runDir, statusRunDir]);
});

test('zynna-switch-actor writes result and supports status lookup', async () => {
  const runDir = path.join(SWITCH_ACTOR_SKILL_DIR, '.artifacts', 'smoke-switch-actor');
  const statusRunDir = path.join(SWITCH_ACTOR_SKILL_DIR, '.artifacts', 'smoke-switch-status');
  cleanup([runDir, statusRunDir]);

  const result = await runSwitchActor({
    runId: 'smoke-switch-actor',
    skillDir: SWITCH_ACTOR_SKILL_DIR,
    originalVideoUrl: 'https://example.com/original.mp4',
    actorImageUrl: 'https://example.com/actor.jpg',
    client: new FakeClient(),
    pollInterval: 0.01,
    timeoutSec: 1,
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.videoUrl, 'https://example.com/switch-output.mp4');

  const statusResult = await runSwitchActorStatus({
    runId: 'smoke-switch-status',
    skillDir: SWITCH_ACTOR_SKILL_DIR,
    taskId: 'switch_task_1',
    client: new FakeClient(),
  });

  assert.equal(statusResult.videoUrl, 'https://example.com/switch-output.mp4');
  cleanup([runDir, statusRunDir]);
});

test('artifact helper rejects unsafe run_id traversal', () => {
  assert.throws(
    () => artifactsForRun(ANALYZE_SKILL_DIR, '../escape'),
    /Invalid run_id/
  );
});

test('runtime config blocks insecure non-local HTTP by default', () => {
  const prevBase = process.env.ZYNNA_BASE_URL;
  const prevKey = process.env.ZYNNA_SKILLS_API_KEY;
  const prevInsecure = process.env.ZYNNA_ALLOW_INSECURE_HTTP;

  try {
    process.env.ZYNNA_BASE_URL = 'http://example.com';
    process.env.ZYNNA_SKILLS_API_KEY = 'test-key';
    delete process.env.ZYNNA_ALLOW_INSECURE_HTTP;
    assert.throws(() => getZynnaConfig(), /Refusing insecure non-local HTTP URL/);

    process.env.ZYNNA_ALLOW_INSECURE_HTTP = '1';
    const cfg = getZynnaConfig();
    assert.equal(cfg.baseUrl, 'http://example.com');
  } finally {
    if (prevBase === undefined) delete process.env.ZYNNA_BASE_URL;
    else process.env.ZYNNA_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.ZYNNA_SKILLS_API_KEY;
    else process.env.ZYNNA_SKILLS_API_KEY = prevKey;
    if (prevInsecure === undefined) delete process.env.ZYNNA_ALLOW_INSECURE_HTTP;
    else process.env.ZYNNA_ALLOW_INSECURE_HTTP = prevInsecure;
  }
});
