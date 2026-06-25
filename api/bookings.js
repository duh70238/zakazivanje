const FILE_PATH = process.env.GITHUB_FILE || 'data/bookings.json';

function githubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo };
}

async function githubFetch(path, options = {}) {
  const cfg = githubConfig();
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  return res;
}

async function readFromGitHub() {
  const res = await githubFetch(FILE_PATH);
  if (res.status === 404) {
    return { appointments: [], updatedAt: 0, sha: null };
  }
  if (!res.ok) {
    throw new Error(`GitHub read failed: ${res.status}`);
  }
  const meta = await res.json();
  const text = Buffer.from(meta.content, 'base64').toString('utf8');
  const data = JSON.parse(text);
  return {
    appointments: Array.isArray(data.appointments) ? data.appointments : [],
    updatedAt: data.updatedAt || 0,
    sha: meta.sha,
  };
}

async function writeToGitHub(appointments, sha) {
  const payload = {
    appointments,
    updatedAt: Date.now(),
  };
  const body = {
    message: 'Azuriranje termina [skip ci]',
    content: Buffer.from(JSON.stringify(payload, null, 2)).toString('base64'),
  };
  if (sha) body.sha = sha;

  const res = await githubFetch(FILE_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub write failed: ${res.status}`);
  }

  const result = await res.json();
  return { ok: true, sha: result.content.sha, count: appointments.length };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!githubConfig()) {
    return res.status(503).json({
      error: 'GitHub nije podešen. Dodaj GITHUB_TOKEN, GITHUB_OWNER i GITHUB_REPO na Vercel-u.',
      appointments: [],
    });
  }

  try {
    if (req.method === 'GET') {
      const data = await readFromGitHub();
      return res.status(200).json({
        appointments: data.appointments,
        updatedAt: data.updatedAt,
        source: 'github',
      });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.appointments)) {
        return res.status(400).json({ error: 'Neispravan format.' });
      }

      const current = await readFromGitHub();
      const result = await writeToGitHub(body.appointments, current.sha);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Metoda nije dozvoljena.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Greška na serveru.' });
  }
}
