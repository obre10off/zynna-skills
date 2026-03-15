function getZynnaConfig() {
  const apiKey = process.env.ZYNNA_SKILLS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing ZYNNA_SKILLS_API_KEY. Set env ZYNNA_SKILLS_API_KEY before running this skill.');
  }

  return {
    baseUrl: process.env.ZYNNA_BASE_URL || 'http://localhost:8080',
    openSkillsKey: String(apiKey),
  };
}

module.exports = {
  getZynnaConfig,
};
