const fs = require('node:fs');
const path = require('node:path');

function ensureOutputs(skillDir) {
  const outDir = path.join(skillDir, 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  return outDir;
}

function writeAdPackage(skillDir, pkg) {
  const outDir = ensureOutputs(skillDir);
  const jsonPath = path.join(outDir, 'ad_package.json');
  const mdPath = path.join(outDir, 'ad_package.md');

  fs.writeFileSync(jsonPath, JSON.stringify(pkg, null, 2), 'utf8');

  const lines = [
    '# Meta Ad Creative Package',
    '',
    '## Product',
    pkg.metadata.product,
    '',
    '## Audience',
    pkg.metadata.audience,
    '',
    '## Creative',
    '',
    '### Headline',
    pkg.creative.headline,
    '',
    '### Body Copy',
    pkg.creative.body_copy,
    '',
    '### Call to Action',
    pkg.creative.cta_label,
    '',
    '### Image',
    pkg.creative.primary_image_url
      ? `![Ad Creative](${pkg.creative.primary_image_url})`
      : '_No image generated — source manually from brand asset library._',
    '',
    '## Destination',
    pkg.links.destination_url,
    '',
    '## Upload Instructions',
    '',
    '1. Open **Meta Ads Manager** → **Create** → Select your campaign objective',
    '2. Upload the image from `outputs/` or use the Zynna-generated image URL',
    '3. Paste the headline and body copy into the appropriate fields',
    '4. Set the CTA to **' + pkg.creative.cta_label + '**',
    '5. Paste the **Destination URL** (includes UTM parameters)',
    '',
    '## Metadata',
    `Generated: ${pkg.metadata.generated_at}`,
  ];

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

  return { jsonPath, mdPath };
}

function readLastRun(skillDir) {
  const lastRunPath = path.join(skillDir, 'outputs', 'last_run.json');
  if (!fs.existsSync(lastRunPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(lastRunPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeLastRun(skillDir, runData) {
  const outDir = ensureOutputs(skillDir);
  const lastRunPath = path.join(outDir, 'last_run.json');
  fs.writeFileSync(lastRunPath, JSON.stringify(runData, null, 2), 'utf8');
}

module.exports = {
  writeAdPackage,
  readLastRun,
  writeLastRun,
};
