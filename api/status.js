function envCheck() {
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const owner = (process.env.GITHUB_OWNER || '').trim();
  const repo = (process.env.GITHUB_REPO || '').trim();
  const missing = [];
  if (!token) missing.push('GITHUB_TOKEN');
  if (!owner) missing.push('GITHUB_OWNER');
  if (!repo) missing.push('GITHUB_REPO');
  return { token: !!token, owner, repo, missing, ready: missing.length === 0 };
}

module.exports = async function handler(req, res) {
  const c = envCheck();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: c.ready,
    message: c.ready
      ? `Povezano na GitHub: ${c.owner}/${c.repo}`
      : `Fali na Vercel-u: ${c.missing.join(', ')}. Dodaj ih i uradi REDEPLOY.`,
    hasToken: c.token,
    hasOwner: !!c.owner,
    hasRepo: !!c.repo,
    owner: c.owner || null,
    repo: c.repo || null,
    missing: c.missing,
  });
};
