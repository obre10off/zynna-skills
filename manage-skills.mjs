#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const DIST_DIR = path.join(REPO_ROOT, 'dist', 'skills');
const SKILL_DIRS = [
  'zynna-auth',
  'zynna-analyze-video',
  'zynna-recreate-video',
  'zynna-generate-video',
  'zynna-scene-builder',
  'zynna-switch-actor',
  'zynna-video-agent',
];
const INSTALL_DIRS = [
  path.join(os.homedir(), '.codex', 'skills'),
  path.join(os.homedir(), '.claude', 'skills'),
  path.join(os.homedir(), '.agents', 'skills'),
];

function assertSkillTree() {
  for (const name of SKILL_DIRS) {
    const skillMd = path.join(SKILLS_ROOT, name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      throw new Error(`Missing skill: ${skillMd}`);
    }
  }
}

function run(cmd, args, cwd = REPO_ROOT) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed`);
  }
}

function cleanTransientFiles(root) {
  const artifacts = path.join(root, '.artifacts');
  if (fs.existsSync(artifacts)) {
    fs.rmSync(artifacts, { recursive: true, force: true });
  }
}

function packageAll() {
  assertSkillTree();
  fs.mkdirSync(DIST_DIR, { recursive: true });

  for (const name of SKILL_DIRS) {
    const skillDir = path.join(SKILLS_ROOT, name);
    cleanTransientFiles(skillDir);

    const out = path.join(DIST_DIR, `${name}.skill`);
    if (fs.existsSync(out)) fs.rmSync(out, { force: true });

    run('zip', ['-r', '-q', out, name, '-x', `${name}/.artifacts/*`, `${name}/node_modules/*`], SKILLS_ROOT);
  }

  console.log(`OK: packaged skills into ${DIST_DIR}`);
}

function installAll() {
  assertSkillTree();

  for (const root of INSTALL_DIRS) {
    fs.mkdirSync(root, { recursive: true });

    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith('zynna-')) continue;
      if (SKILL_DIRS.includes(entry.name)) continue;
      fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
    }

    for (const skillName of SKILL_DIRS) {
      const src = path.join(SKILLS_ROOT, skillName);
      const dst = path.join(root, skillName);
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
      fs.cpSync(src, dst, { recursive: true, force: true });
      cleanTransientFiles(dst);
    }
  }

  console.log(`OK: installed skills into ${INSTALL_DIRS.join(', ')}`);
}

function main() {
  const cmd = process.argv[2];
  if (!cmd || !['package', 'install', 'update'].includes(cmd)) {
    console.error('Usage: node manage-skills.mjs <package|install|update>');
    process.exit(2);
  }

  if (cmd === 'package') packageAll();
  if (cmd === 'install') installAll();
  if (cmd === 'update') {
    packageAll();
    installAll();
  }
}

main();
