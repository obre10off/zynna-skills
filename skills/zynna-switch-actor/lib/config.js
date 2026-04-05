const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INSECURE_OVERRIDE_ENV = 'ZYNNA_ALLOW_INSECURE_HTTP';

function loadStoredApiKey() {
  const credsFile = process.env.ZYNNA_CREDENTIALS_FILE || path.join(os.homedir(), '.zynna', 'credentials.json');
  if (!fs.existsSync(credsFile)) return '';
  try {
    const raw = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
    return String(raw.api_key || raw.open_skills_api_key || '').trim();
  } catch {
    return '';
  }
}

function isLoopbackHost(hostname) {
  const value = String(hostname || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]';
}

function validateBaseUrl(baseUrl, source = 'ZYNNA_BASE_URL') {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid ${source}: ${baseUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Invalid ${source}: only http/https URLs are supported`);
  }

  if (parsed.protocol === 'http:') {
    const insecureOverride = String(process.env[INSECURE_OVERRIDE_ENV] || '') === '1';
    if (!insecureOverride && !isLoopbackHost(parsed.hostname)) {
      throw new Error(
        `Refusing insecure non-local HTTP URL in ${source}. Use HTTPS or set ${INSECURE_OVERRIDE_ENV}=1 for explicit insecure override.`
      );
    }
  }

  return parsed.toString().replace(/\/+$/, '');
}

function getZynnaConfig() {
  const apiKey = String(process.env.ZYNNA_SKILLS_API_KEY || '').trim() || loadStoredApiKey();
  if (!apiKey) {
    throw new Error(
      'Missing API key. Either set ZYNNA_SKILLS_API_KEY or run node skills/zynna-auth/scripts/auth.js login.'
    );
  }

  return {
    baseUrl: validateBaseUrl(process.env.ZYNNA_BASE_URL || 'http://localhost:8080'),
    openSkillsKey: apiKey,
  };
}

module.exports = {
  getZynnaConfig,
  validateBaseUrl,
};
