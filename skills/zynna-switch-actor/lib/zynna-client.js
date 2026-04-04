const { getZynnaConfig } = require('./config');

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

function summarizeApiPayload(payload) {
  if (!payload || typeof payload !== 'object') return '(empty payload)';
  const code = Object.prototype.hasOwnProperty.call(payload, 'code') ? String(payload.code) : 'unknown';
  const message = redactSensitiveText(payload.message || payload.msg || '').slice(0, 200);
  return message ? `code=${code}, message=${message}` : `code=${code}`;
}

class ZynnaOpenSkillsClient {
  constructor(cfg) {
    this.cfg = cfg;
  }

  async requestJson(method, url, { body, timeoutSec = 60 } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutSec) * 1000);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.openSkillsKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const safeBody = redactSensitiveText(text).slice(0, 500);
      const safeUrl = sanitizeUrlForLog(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} calling ${safeUrl}. Body: ${safeBody}`);
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new Error(`Invalid JSON response from ${safeUrl}: ${error}. Body: ${safeBody}`);
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  assertApiSuccess(payload, context) {
    if (payload && payload.code === 0) {
      return;
    }
    throw new Error(`Zynna ${context} failed: ${summarizeApiPayload(payload)}`);
  }

  async submitSwitchActorTask(taskBody, timeoutSec = 120) {
    const payload = await this.requestJson('POST', `${this.cfg.baseUrl}/api/open/skills/switch-actor/tasks`, {
      body: taskBody,
      timeoutSec,
    });

    this.assertApiSuccess(payload, 'switch actor submit');
    return payload.data || {};
  }

  async estimateSwitchActorTask(taskBody, timeoutSec = 120) {
    const payload = await this.requestJson('POST', `${this.cfg.baseUrl}/api/open/skills/switch-actor/tasks/estimate`, {
      body: taskBody,
      timeoutSec,
    });

    this.assertApiSuccess(payload, 'switch actor estimate');
    return payload.data || {};
  }

  async getSwitchActorTaskStatus(taskId, timeoutSec = 60) {
    const payload = await this.requestJson(
      'GET',
      `${this.cfg.baseUrl}/api/open/skills/switch-actor/tasks/status?task_id=${encodeURIComponent(taskId)}`,
      { timeoutSec }
    );

    this.assertApiSuccess(payload, 'switch actor status');
    return payload.data || {};
  }
}

function defaultClient() {
  return new ZynnaOpenSkillsClient(getZynnaConfig());
}

module.exports = {
  ZynnaOpenSkillsClient,
  defaultClient,
};
