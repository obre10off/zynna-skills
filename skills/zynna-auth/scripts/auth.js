#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { spawnSync } = require('node:child_process');

const DEFAULT_API_BASE = process.env.ZYNNA_AUTH_API_BASE || process.env.ZYNNA_BASE_URL || 'http://localhost:8080';
const DEFAULT_WEB_BASE = process.env.ZYNNA_AUTH_WEB_BASE || process.env.ZYNNA_FRONTEND_URL || 'http://localhost:3000';
const DEVICE_INIT_PATH = process.env.ZYNNA_DEVICE_INIT_PATH || '/api/open/skills/auth/device/init';
const DEVICE_TOKEN_PATH = process.env.ZYNNA_DEVICE_TOKEN_PATH || '/api/open/skills/auth/device/token';
const CLIENT_ID = process.env.ZYNNA_AUTH_CLIENT_ID || 'zynna-skills';
const SCOPE = process.env.ZYNNA_AUTH_SCOPE || 'read:profile read:billing read:apikey';
const INSECURE_OVERRIDE_ENV = 'ZYNNA_ALLOW_INSECURE_HTTP';
const DEFAULT_TIMEOUT_SEC = (() => {
  const raw = Number(process.env.ZYNNA_AUTH_TIMEOUT_SEC || 600);
  if (!Number.isFinite(raw) || raw < 1 || raw > 86400) return 600;
  return raw;
})();
const CREDENTIALS_DIR = path.join(os.homedir(), '.zynna');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');
const PENDING_FILE = path.join(CREDENTIALS_DIR, 'pending_device.json');
const API_DOC_URL = process.env.ZYNNA_API_ACCESS_DOC_URL || 'https://zynna.ai/pricing';

function usage() {
  console.error('Usage: auth.js <login|poll|status|logout> [--no-open] [--timeout_sec <seconds>]');
}

function parsePositiveNumber(name, value, { min, max }) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new Error(`Invalid ${name}. Expected a number in range [${min}, ${max}].`);
  }
  return num;
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || '',
    noOpen: false,
    timeoutSec: DEFAULT_TIMEOUT_SEC,
  };

  for (let i = 3; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--no-open') {
      args.noOpen = true;
      continue;
    }
    const value = argv[i + 1];
    if (key === '--timeout_sec') {
      args.timeoutSec = parsePositiveNumber('--timeout_sec', value, { min: 1, max: 86400 });
      i += 1;
    }
  }

  return args;
}

function setPermissionSafe(filePath, mode) {
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // Best effort across OS/filesystem differences.
  }
}

function ensureDir() {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  setPermissionSafe(CREDENTIALS_DIR, 0o700);
}

function loadJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  setPermissionSafe(file, 0o600);
}

function removeFile(file) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function retrofitCredentialPermissions() {
  ensureDir();
  if (fs.existsSync(CREDENTIALS_FILE)) setPermissionSafe(CREDENTIALS_FILE, 0o600);
  if (fs.existsSync(PENDING_FILE)) setPermissionSafe(PENDING_FILE, 0o600);
}

function joinUrl(base, pathOrUrl) {
  if (!pathOrUrl) return base;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${base.replace(/\/+$/, '')}/${String(pathOrUrl).replace(/^\/+/, '')}`;
}

function isLoopbackHost(hostname) {
  const value = String(hostname || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]';
}

function assertAllowedTransport(urlValue, sourceName) {
  let parsed;
  try {
    parsed = new URL(urlValue);
  } catch {
    throw new Error(`Invalid ${sourceName}: ${urlValue}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Invalid ${sourceName}: only http/https URLs are supported`);
  }

  if (parsed.protocol === 'http:') {
    const insecureOverride = String(process.env[INSECURE_OVERRIDE_ENV] || '') === '1';
    if (!insecureOverride && !isLoopbackHost(parsed.hostname)) {
      throw new Error(
        `Refusing insecure non-local HTTP URL in ${sourceName}. Use HTTPS or set ${INSECURE_OVERRIDE_ENV}=1 for explicit insecure override.`
      );
    }
  }

  return parsed;
}

function sanitizeUrlForLog(urlValue) {
  try {
    const parsed = new URL(urlValue);
    for (const key of ['token', 'device_code', 'api_key', 'open_skills_api_key', 'authorization']) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return '(invalid-url)';
  }
}

function redactSensitiveText(input) {
  const text = String(input || '');
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/((?:token|device_code|api_key|open_skills_api_key|authorization)\s*["'=:\s]+)([^"\s,}&]+)/gi, '$1[REDACTED]');
}

function normalizeApiEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'result')) {
    const code = String(payload.code ?? '200');
    if (code !== '200') {
      const msg = payload.message || `Auth API returned code ${code}`;
      throw new Error(msg);
    }
    return payload.result || {};
  }
  return payload;
}

async function requestJson(url, options = {}) {
  const safeUrl = sanitizeUrlForLog(url);
  assertAllowedTransport(url, 'request URL');

  const response = await fetch(url, options);
  const text = await response.text();
  const safeBody = redactSensitiveText(text).slice(0, 300);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} calling ${safeUrl}. Body: ${safeBody}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${safeUrl}. Body: ${safeBody}`);
  }
  return normalizeApiEnvelope(payload);
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
}

function getAllowedPlans() {
  const raw = process.env.ZYNNA_ALLOWED_API_PLANS || 'business';
  return raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function normalizePlan(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function collectPlanCandidates(payload) {
  const candidates = new Set();
  const raw = [
    payload.charge_type,
    payload.plan,
    payload.plan_name,
    payload.subscription_plan,
    payload.tier,
    payload.package_name,
    payload.membership,
  ];
  for (const entry of raw) {
    const normalized = normalizePlan(entry);
    if (normalized) candidates.add(normalized);
  }
  return [...candidates];
}

function isAllowedPlan(payload) {
  if (String(process.env.ZYNNA_AUTH_SKIP_PLAN_CHECK || '') === '1') {
    return { ok: true, reason: 'Plan check bypassed by ZYNNA_AUTH_SKIP_PLAN_CHECK=1' };
  }
  const allowed = getAllowedPlans().map(normalizePlan);
  if (allowed.length === 0) {
    return { ok: true, reason: 'No plan restrictions configured' };
  }
  const candidates = collectPlanCandidates(payload);
  const ok = candidates.some((candidate) => allowed.includes(candidate));
  if (ok) {
    return { ok: true, reason: `Matched plan: ${candidates.find((c) => allowed.includes(c))}` };
  }
  return {
    ok: false,
    reason: `Your plan is not eligible for API access. Required: ${allowed.join(', ')}. Detected: ${candidates.join(', ') || '(none)'}`,
  };
}

function extractCredentials(payload) {
  const apiKey = firstNonEmpty([
    payload.open_skills_api_key,
    payload.api_key,
    payload.apiKey,
    Array.isArray(payload.api_keys) ? payload.api_keys[0] : '',
  ]);
  const uid = firstNonEmpty([payload.uid, payload.user_id, payload.userId]);
  const email = firstNonEmpty([payload.email]);
  const name = firstNonEmpty([payload.name, payload.display_name]);
  return { apiKey, uid, email, name };
}

function formatStatus(rawStatus) {
  const status = String(rawStatus || '').toUpperCase();
  if (!status) return '';
  if (status === 'INITIATED' || status === 'PENDING') return 'pending';
  if (status === 'APPROVED') return 'approved';
  if (status === 'DENIED') return 'denied';
  if (status === 'EXPIRED') return 'expired';
  if (status === 'INELIGIBLE_PLAN') return 'ineligible_plan';
  return status.toLowerCase();
}

function openInBrowser(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    return spawnSync('open', [url], { stdio: 'ignore' }).status === 0;
  }
  if (platform === 'win32') {
    return spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' }).status === 0;
  }
  return spawnSync('xdg-open', [url], { stdio: 'ignore' }).status === 0;
}

function printLoginMessage(url, timeoutSec) {
  console.log('');
  console.log('Use this URL to sign in:');
  console.log(`URL: ${url}`);
  console.log(`Session timeout: ${timeoutSec}s`);
  console.log('After sign-in, this command will continue automatically.');
  console.log('');
}

function getConfiguredBases() {
  const apiBase = assertAllowedTransport(DEFAULT_API_BASE, 'ZYNNA_AUTH_API_BASE/ZYNNA_BASE_URL')
    .toString()
    .replace(/\/+$/, '');
  const webBase = assertAllowedTransport(DEFAULT_WEB_BASE, 'ZYNNA_AUTH_WEB_BASE/ZYNNA_FRONTEND_URL')
    .toString()
    .replace(/\/+$/, '');
  return { apiBase, webBase };
}

async function startLogin(args) {
  const { apiBase, webBase } = getConfiguredBases();

  const initUrl = joinUrl(apiBase, DEVICE_INIT_PATH);
  const initPayload = await requestJson(initUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: SCOPE,
      source: 'zynna-skills',
    }),
  });

  const deviceCode = firstNonEmpty([initPayload.device_code, initPayload.deviceCode, initPayload.token]);
  if (!deviceCode) {
    throw new Error('Auth init response missing device_code');
  }

  const verificationUrl =
    firstNonEmpty([
      initPayload.verification_uri_complete,
      initPayload.verificationUrl,
      initPayload.verification_uri,
    ]) || joinUrl(webBase, `/oauth/device?token=${encodeURIComponent(deviceCode)}`);

  assertAllowedTransport(verificationUrl, 'verification URL');

  const tokenEndpoint =
    firstNonEmpty([initPayload.token_endpoint, initPayload.tokenEndpoint]) ||
    joinUrl(apiBase, DEVICE_TOKEN_PATH);

  const intervalSec = Number(initPayload.interval || 2);
  const expiresInSec = Number(initPayload.expires_in || args.timeoutSec || DEFAULT_TIMEOUT_SEC);

  const pending = {
    created_at: new Date().toISOString(),
    api_base: apiBase,
    web_base: webBase,
    token_endpoint: tokenEndpoint,
    device_code: deviceCode,
    interval_sec: intervalSec,
    timeout_sec: expiresInSec,
    verification_url: verificationUrl,
  };
  saveJson(PENDING_FILE, pending);

  printLoginMessage(verificationUrl, expiresInSec);

  if (!args.noOpen) {
    openInBrowser(verificationUrl);
  }

  await pollForApproval({
    ...pending,
    timeout_sec: Math.max(1, Number(args.timeoutSec || expiresInSec)),
  });
}

async function fetchTokenStatus(tokenEndpoint, deviceCode) {
  const endpoint = assertAllowedTransport(tokenEndpoint, 'token endpoint');
  const url = new URL(endpoint.toString());
  url.searchParams.set('token', deviceCode);
  url.searchParams.set('device_code', deviceCode);
  return requestJson(url.toString());
}

async function pollForApproval(pending) {
  const timeoutSec = Number(pending.timeout_sec || DEFAULT_TIMEOUT_SEC);
  let intervalSec = Number(pending.interval_sec || 2);
  const started = Date.now();

  process.stderr.write('Waiting for authorization...\n');
  while ((Date.now() - started) / 1000 <= timeoutSec) {
    await sleep(Math.max(1, intervalSec) * 1000);
    const elapsed = Math.floor((Date.now() - started) / 1000);
    process.stderr.write(`  [${elapsed}s] checking\r`);

    let payload;
    try {
      payload = await fetchTokenStatus(pending.token_endpoint, pending.device_code);
    } catch {
      continue;
    }

    const status = formatStatus(payload.status || payload.state);
    intervalSec = Number(payload.interval || intervalSec);

    if (status === 'pending') {
      continue;
    }
    if (status === 'denied') {
      removeFile(PENDING_FILE);
      throw new Error('Authorization denied by user.');
    }
    if (status === 'ineligible_plan') {
      removeFile(PENDING_FILE);
      throw new Error(payload.message || `API access requires eligible plan. Upgrade here: ${API_DOC_URL}`);
    }
    if (status === 'expired') {
      removeFile(PENDING_FILE);
      throw new Error('Authorization session expired. Run login again.');
    }
    if (status !== 'approved') {
      continue;
    }

    const planCheck = isAllowedPlan(payload);
    if (!planCheck.ok) {
      removeFile(PENDING_FILE);
      throw new Error(`${planCheck.reason} Upgrade here: ${API_DOC_URL}`);
    }

    const creds = extractCredentials(payload);
    if (!creds.apiKey) {
      removeFile(PENDING_FILE);
      throw new Error('Authorization succeeded but no API key was returned by auth API.');
    }

    const plan = collectPlanCandidates(payload).join(',') || '';
    const doc = {
      uid: creds.uid || '',
      api_key: creds.apiKey,
      email: creds.email || '',
      name: creds.name || '',
      plan,
      charge_type: firstNonEmpty([payload.charge_type]),
      created_at: new Date().toISOString(),
      auth_api_base: DEFAULT_API_BASE,
    };
    saveJson(CREDENTIALS_FILE, doc);
    removeFile(PENDING_FILE);

    process.stderr.write('\n');
    console.log('Login successful. Credentials saved to ~/.zynna/credentials.json');
    if (doc.plan) {
      console.log(`Plan: ${doc.plan}`);
    }
    return;
  }

  throw new Error(`Timeout waiting for authorization (${timeoutSec}s). You can resume with: node scripts/auth.js poll`);
}

function printStatus() {
  const creds = loadJson(CREDENTIALS_FILE);
  if (!creds) {
    console.log('Not logged in. No credentials found at ~/.zynna/credentials.json');
    return;
  }
  const masked =
    creds.api_key && creds.api_key.length > 10
      ? `${creds.api_key.slice(0, 6)}...${creds.api_key.slice(-4)}`
      : '(set)';
  console.log('Logged in.');
  console.log(`uid: ${creds.uid || '(unknown)'}`);
  console.log(`email: ${creds.email || '(unknown)'}`);
  console.log(`plan: ${creds.plan || creds.charge_type || '(unknown)'}`);
  console.log(`api_key: ${masked}`);
  console.log(`saved_at: ${creds.created_at || '(unknown)'}`);
}

function logout() {
  const hadCreds = fs.existsSync(CREDENTIALS_FILE);
  const hadPending = fs.existsSync(PENDING_FILE);
  removeFile(CREDENTIALS_FILE);
  removeFile(PENDING_FILE);
  if (!hadCreds && !hadPending) {
    console.log('Already logged out.');
    return;
  }
  console.log('Logged out. Removed local Zynna auth files.');
}

async function resumePoll(args) {
  const pending = loadJson(PENDING_FILE);
  if (!pending) {
    throw new Error('No pending login session found. Start a new one with: node scripts/auth.js login');
  }
  await pollForApproval({
    ...pending,
    timeout_sec: Math.max(1, Number(args.timeoutSec || pending.timeout_sec || DEFAULT_TIMEOUT_SEC)),
  });
}

async function main() {
  retrofitCredentialPermissions();

  const args = parseArgs(process.argv);
  const command = args.command;

  if (!['login', 'poll', 'status', 'logout'].includes(command)) {
    usage();
    process.exit(2);
  }

  if (command === 'login') {
    await startLogin(args);
    return;
  }
  if (command === 'poll') {
    await resumePoll(args);
    return;
  }
  if (command === 'status') {
    printStatus();
    return;
  }
  if (command === 'logout') {
    logout();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
