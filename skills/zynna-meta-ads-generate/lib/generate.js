const path = require('node:path');
const { ZynnaOpenSkillsClient } = require('./zynna-client');
const { writeAdPackage, readLastRun, writeLastRun } = require('./artifacts');

const CTAS = [
  'Shop Now', 'Learn More', 'Sign Up', 'Get Quote', 'Book Now',
  'Download', 'Contact Us', 'Subscribe', 'Apply Now', 'Get Offer',
];

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildUtmUrl(destination, product, audience) {
  const base = destination.replace(/\?.*$/, '').replace(/\/+$/, '');
  const campaign = slugify(`${product}-${audience}`);
  const utm = `utm_source=facebook&utm_medium=social&utm_campaign=${campaign}`;
  return `${base}?${utm}`;
}

function estimateCredits(client, taskBody) {
  return client.estimateImageTask(taskBody);
}

async function pollUntilDone(client, taskId, { pollInterval = 5, timeoutSec = 300 } = {}) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const status = await client.getImageTaskStatus(taskId);
    const state = status.status || status.state || '';
    if (['succeeded', 'completed', 'done', 'success'].includes(state.toLowerCase())) {
      return { done: true, status };
    }
    if (['failed', 'error', 'cancelled'].includes(state.toLowerCase())) {
      return { done: true, status, error: true };
    }
    await sleep(pollInterval * 1000);
  }
  return { done: false, error: false };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGenerateAd({ runId, skillDir, product, audience, offer, destinationUrl, autoGenerate = true, pollInterval = 5, timeoutSec = 300 }) {
  const client = new ZynnaOpenSkillsClient(require('./config').getZynnaConfig());

  // Check for recovery
  const lastRun = readLastRun(skillDir);
  if (lastRun && lastRun.run_id === runId && lastRun.status === 'succeeded') {
    return lastRun;
  }

  // 1. Build creative content
  const headline = `${product}: ${offer}`;
  const cta = CTAS[Math.floor(Math.random() * CTAS.length)];
  const bodyCopy = [
    `${offer}. Built for people who want results — not compromises.`,
    `This is what ${audience} has been waiting for.`,
    `Limited availability. ${offer}.`,
  ].join(' ');

  const utmUrl = buildUtmUrl(destinationUrl, product, audience);
  const campaignSlug = slugify(`${product}-${audience}`);

  // 2. Image task
  let imageUrl = null;
  let imageTaskId = null;

  try {
    const imageTaskBody = {
      prompt: `${product} advertisement, professional product photography, Meta/Facebook ad format, 4:5 aspect ratio, clean background, high conversion creative`,
      model: 'flux',
      width: 1024,
      height: 1280,
      num_images: 1,
    };

    if (autoGenerate) {
      const est = await estimateCredits(client, imageTaskBody);
      console.error(`[estimate] credits: ${JSON.stringify(est)}`);

      imageTaskId = await client.submitImageTask(imageTaskBody);
      console.error(`[image] task_id=${imageTaskId.task_id || imageTaskId.id || imageTaskId}`);

      const pollResult = await pollUntilDone(client, imageTaskId.task_id || imageTaskId.id || imageTaskId, { pollInterval, timeoutSec });
      if (pollResult.error) {
        console.error('[image] generation failed — proceeding with copy only');
      } else {
        imageUrl = (pollResult.status.images || pollResult.status.output_url || pollResult.status.url || null);
      }
    }
  } catch (err) {
    console.error(`[image] error: ${err.message} — proceeding with copy only`);
  }

  // 3. Write output
  const pkg = {
    version: '1.0',
    platform: 'meta',
    creative: {
      primary_image_url: imageUrl,
      variations: [],
      headline,
      body_copy: bodyCopy,
      cta_label: cta,
    },
    links: {
      destination_url: utmUrl,
      utm_params: {
        utm_source: 'facebook',
        utm_medium: 'social',
        utm_campaign: campaignSlug,
      },
    },
    metadata: {
      product,
      audience,
      generated_at: new Date().toISOString(),
    },
  };

  const { jsonPath, mdPath } = writeAdPackage(skillDir, pkg);

  const result = {
    run_id: runId,
    task_id: imageTaskId ? (imageTaskId.task_id || imageTaskId.id || imageTaskId) : null,
    status: imageUrl ? 'succeeded' : 'partial',
    output_url: imageUrl,
    package_path: jsonPath,
    handoff_path: mdPath,
  };

  writeLastRun(skillDir, result);
  return result;
}

module.exports = { runGenerateAd };
