import { head, put } from '@vercel/blob';

const BLOB_NAME = 'salon-bookings.json';

async function readBookings() {
  try {
    const blob = await head(BLOB_NAME);
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return { appointments: [] };
    const data = await res.json();
    return Array.isArray(data.appointments) ? data : { appointments: [] };
  } catch {
    return { appointments: [] };
  }
}

async function writeBookings(data) {
  await put(BLOB_NAME, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'Blob storage nije podešen. Dodaj BLOB_READ_WRITE_TOKEN na Vercel-u.',
      appointments: [],
    });
  }

  try {
    if (req.method === 'GET') {
      const data = await readBookings();
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.appointments)) {
        return res.status(400).json({ error: 'Neispravan format podataka.' });
      }
      await writeBookings(body);
      return res.status(200).json({ ok: true, count: body.appointments.length });
    }

    return res.status(405).json({ error: 'Metoda nije dozvoljena.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Greška na serveru.' });
  }
}
