const fs = require('node:fs');
const path = require('node:path');

const RUN_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;

function assertWithinRoot(root, targetPath, label) {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(targetPath);
  if (normalizedTarget === normalizedRoot) {
    return normalizedTarget;
  }
  if (!normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Unsafe ${label} path escaped artifacts root`);
  }
  return normalizedTarget;
}

function validateRunId(runId) {
  const value = String(runId || '');
  if (!RUN_ID_RE.test(value)) {
    throw new Error(
      'Invalid run_id. Use 1-80 chars from: letters, numbers, dot, underscore, dash.'
    );
  }
  return value;
}

class Artifacts {
  constructor(root) {
    this.root = path.resolve(root);
  }

  ensure() {
    for (const name of ['input', 'transcript', 'vision', 'outputs', 'logs']) {
      const dirPath = assertWithinRoot(this.root, path.join(this.root, name), 'directory');
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  resolveFilePath(relPath) {
    if (path.isAbsolute(relPath)) {
      throw new Error('Artifact path must be relative');
    }
    return assertWithinRoot(this.root, path.join(this.root, relPath), 'file');
  }

  writeJson(relPath, obj) {
    const filePath = this.resolveFilePath(relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
    return filePath;
  }

  writeText(relPath, text) {
    const filePath = this.resolveFilePath(relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
    return filePath;
  }
}

function artifactsRootForSkill(skillDir) {
  return path.join(skillDir, '.artifacts');
}

function artifactsForRun(skillDir, runId) {
  const safeRunId = validateRunId(runId);
  const root = artifactsRootForSkill(skillDir);
  const runRoot = assertWithinRoot(root, path.join(root, safeRunId), 'run');
  return new Artifacts(runRoot);
}

module.exports = {
  Artifacts,
  artifactsRootForSkill,
  artifactsForRun,
  validateRunId,
};
