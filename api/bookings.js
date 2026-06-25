import { head, put } from '@vercel/blob';

const PRIMARY = 'termini.json';
const BACKUP = 'termini-backup.json';

async function readBlob(name) {
  try {
    const blob = await head(name);
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeBlob(name, data) {
  await put(name, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

function mergeAppointments(...lists) {
  const map = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const a of list) {
      if (!a?.id) continue;
      const ex = map.get(a.id);
      if (!ex || (a.updatedAt || 0) >= (ex.updatedAt || 0)) map.set(a.id, a);
    }
  }
  return Array.from(map.values());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'Blob nije povezan. Vercel → Storage → Blob → Connect.',
      appointments: [],
    });
  }

  try {
    if (req.method === 'GET') {
      const primary = await readBlob(PRIMARY);
      const backup = await readBlob(BACKUP);
      const appointments = mergeAppointments(
        backup?.appointments,
        primary?.appointments,
      );
      const updatedAt = Math.max(primary?.updatedAt || 0, backup?.updatedAt || 0);
      return res.status(200).json({ appointments, updatedAt, source: 'cloud' });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.appointments)) {
        return res.status(400).json({ error: 'Neispravan format.' });
      }

      const current = await readBlob(PRIMARY);
      if (current?.appointments?.length) {
        await writeBlob(BACKUP, {
          appointments: current.appointments,
          updatedAt: current.updatedAt || Date.now(),
        });
      }

      const payload = {
        appointments: body.appointments,
        updatedAt: Date.now(),
      };
      await writeBlob(PRIMARY, payload);
      return res.status(200).json({ ok: true, count: body.appointments.length });
    }

    return res.status(405).json({ error: 'Nije dozvoljeno.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Greška na serveru.' });
  }
}
