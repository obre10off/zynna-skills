const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INSECURE_OVERRIDE_ENV = 'ZYNNA_ALLOW_INSECURE_HTTP';

function getMetaConfig() {
  const accessToken = String(process.env.META_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    throw new Error(
      'Missing META_ACCESS_TOKEN. Set it via: export META_ACCESS_TOKEN="<your token>"\n' +
      'Get your token from: Meta Business Suite → Settings → Integrations → Marketing API'
    );
  }

  const adAccountId = String(process.env.META_AD_ACCOUNT_ID || '').trim();
  if (!adAccountId) {
    throw new Error(
      'Missing META_AD_ACCOUNT_ID. Set it via: export META_AD_ACCOUNT_ID="act_<number>"\n' +
      'Find your account ID in Meta Business Suite → Settings → Account information'
    );
  }

  return {
    accessToken,
    adAccountId,
    apiVersion: 'v19.0',
    baseUrl: 'https://graph.facebook.com',
  };
}

function validateDateRange(since, until) {
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  const diffDays = (untilDate - sinceDate) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) {
    console.error(`[warn] Date range ${diffDays.toFixed(0)} days exceeds 90-day limit. Adjusting to 90 days.`);
    const adjusted = new Date(untilDate);
    adjusted.setDate(adjusted.getDate() - 90);
    return { since: adjusted.toISOString().split('T')[0], until };
  }
  return { since, until };
}

class MetaAdsClient {
  constructor(cfg) {
    this.cfg = cfg;
  }

  async requestJson(url, { timeoutSec = 60 } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutSec) * 1000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON from Meta API. Body: ${text.slice(0, 300)}`);
      }

      if (payload.error) {
        const err = payload.error;
        const msg = err.message || JSON.stringify(err);
        throw new Error(`Meta API error ${err.code || '?'}: ${msg}`);
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  _buildUrl(path, params = {}) {
    const base = `${this.cfg.baseUrl}/${this.cfg.apiVersion}${path}`;
    const qs = new URLSearchParams({ access_token: this.cfg.accessToken, ...params });
    return `${base}?${qs}`;
  }

  async listCampaigns() {
    const url = this._buildUrl(`/${this.cfg.adAccountId}/campaigns`, {
      fields: 'id,name,status',
      limit: 100,
    });
    return this.requestJson(url);
  }

  async listAdsets(campaignId) {
    const url = this._buildUrl(`/${campaignId}/adsets`, {
      fields: 'id,name,status',
      limit: 100,
    });
    return this.requestJson(url);
  }

  async getInsights(level, { since, until, campaignId, adsetId }) {
    const fields = [
      'impressions', 'reach', 'spend', 'clicks', 'ctr', 'cpc', 'cpm', 'cpp',
      'actions', 'action_values', 'campaign_name', 'adset_name', 'ad_name',
    ].join(',');

    let endpoint;
    const params = {
      fields,
      time_range: JSON.stringify({ since, until }),
      limit: 100,
    };

    if (level === 'campaign') {
      endpoint = campaignId
        ? `/${campaignId}/insights`
        : `/${this.cfg.adAccountId}/insights`;
    } else if (level === 'adset') {
      endpoint = adsetId ? `/${adsetId}/insights` : `/${this.cfg.adAccountId}/insights`;
    } else {
      endpoint = `/${this.cfg.adAccountId}/insights`;
    }

    const url = this._buildUrl(endpoint, params);
    return this.requestJson(url, { timeoutSec: 120 });
  }
}

function defaultClient() {
  return new MetaAdsClient(getMetaConfig());
}

module.exports = {
  MetaAdsClient,
  getMetaConfig,
  validateDateRange,
  defaultClient,
};
