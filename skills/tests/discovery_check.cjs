#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXPECTED_SKILLS = [
  'zynna-auth',
  'zynna-analyze-video',
  'zynna-recreate-video',
  'zynna-generate-video',
  'zynna-scene-builder',
  'zynna-switch-actor',
];

function stripAnsi(input) {
  return input.replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function runDiscovery() {
  const result = spawnSync('npx', ['-y', 'skills', 'add', '.', '--list'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const cleaned = stripAnsi(output);

  if (result.status !== 0) {
    throw new Error(`skills list command failed with code ${result.status}\n${cleaned}`);
  }

  const missing = EXPECTED_SKILLS.filter((name) => !cleaned.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `Discovery check failed. Missing skills: ${missing.join(', ')}\n` +
      'Expected all skills to appear in `npx skills add . --list` output.\n' +
      cleaned
    );
  }

  process.stdout.write(
    `Discovery check passed. Found all ${EXPECTED_SKILLS.length} expected skills.\n`
  );
}

runDiscovery();
