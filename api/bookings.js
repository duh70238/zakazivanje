const FILE_PATH = process.env.GITHUB_FILE || 'data/bookings.json';
const BACKUP_PATH = 'data/bookings-backup.json';

function envCheck() {
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const owner = (process.env.GITHUB_OWNER || '').trim();
  const repo = (process.env.GITHUB_REPO || '').trim();
  const missing = [];
  if (!token) missing.push('GITHUB_TOKEN');
  if (!owner) missing.push('GITHUB_OWNER');
  if (!repo) missing.push('GITHUB_REPO');
  return { token, owner, repo, missing, ready: missing.length === 0 };
}

function githubEnv() {
  const c = envCheck();
  if (!c.ready) return null;
  return { token: c.token, owner: c.owner, repo: c.repo };
}

async function githubRequest(path, options = {}) {
  const env = githubEnv();
  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  return res;
}

async function readFile(path) {
  const res = await githubRequest(path);
  if (res.status === 404) return { data: { appointments: [], updatedAt: 0 }, sha: null };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub read ${res.status}`);
  }
  const meta = await res.json();
  const text = Buffer.from(meta.content, 'base64').toString('utf8');
  const data = JSON.parse(text);
  return {
    data: {
      appointments: Array.isArray(data.appointments) ? data.appointments : [],
      updatedAt: data.updatedAt || 0,
    },
    sha: meta.sha,
  };
}

async function writeFile(path, content, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
  };
  if (sha) body.sha = sha;

  const res = await githubRequest(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.message || `GitHub write ${res.status}`);
    e.status = res.status;
    throw e;
  }
}

async function saveAppointments(appointments) {
  const current = await readFile(FILE_PATH);

  if (current.sha && current.data.appointments?.length) {
    try {
      const backupMeta = await readFile(BACKUP_PATH);
      await writeFile(
        BACKUP_PATH,
        current.data,
        backupMeta.sha,
        'Backup termina [skip ci]',
      );
    } catch (e) {
      console.warn('Backup preskocen:', e.message);
    }
  }

  const payload = {
    appointments,
    updatedAt: Date.now(),
  };

  try {
    await writeFile(FILE_PATH, payload, current.sha, 'Azuriranje termina [skip ci]');
  } catch (e) {
    if (e.status === 409) {
      const fresh = await readFile(FILE_PATH);
      await writeFile(FILE_PATH, payload, fresh.sha, 'Azuriranje termina [skip ci]');
    } else {
      throw e;
    }
  }

  return payload;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const check = envCheck();
  if (!check.ready) {
    return res.status(503).json({
      error: `Fali: ${check.missing.join(', ')}. Vercel → Settings → Environment Variables → REDEPLOY.`,
      configured: false,
      missing: check.missing,
      appointments: [],
    });
  }

  try {
    if (req.method === 'GET') {
      const primary = await readFile(FILE_PATH);
      let appointments = primary.data.appointments;
      let updatedAt = primary.data.updatedAt;

      if (!appointments.length) {
        const backup = await readFile(BACKUP_PATH);
        if (backup.data.appointments.length) {
          appointments = backup.data.appointments;
          updatedAt = backup.data.updatedAt;
        }
      }

      return res.status(200).json({
        appointments,
        updatedAt,
        source: 'github',
        file: FILE_PATH,
      });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.appointments)) {
        return res.status(400).json({ error: 'Neispravan format.' });
      }

      const payload = await saveAppointments(body.appointments);

      return res.status(200).json({
        ok: true,
        count: body.appointments.length,
        file: FILE_PATH,
        updatedAt: payload.updatedAt,
      });
    }

    return res.status(405).json({ error: 'Nije dozvoljeno.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Greška.' });
  }
};
