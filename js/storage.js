const LS_MAIN = 'termini_main_v2';
const LS_BACKUP = 'termini_backup_v2';
const IDB_NAME = 'termini_db_v2';
const IDB_STORE = 'data';
const MAX_HISTORY = 8;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function idbGet(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLS(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
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
  return Array.from(map.values()).sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
  );
}

window.TerminiSave = {
  mergeAppointments,

  async saveLocal(appointments) {
    const updatedAt = Date.now();
    const prev = readLS(LS_MAIN);
    if (prev?.appointments?.length) {
      writeLS(LS_BACKUP, prev);
    }
    writeLS(LS_MAIN, { appointments, updatedAt });

    await idbSet('main', { appointments, updatedAt });

    const history = (await idbGet('history')) || [];
    history.unshift({ appointments: [...appointments], updatedAt });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    await idbSet('history', history);

    return updatedAt;
  },

  async loadAllLocal() {
    const lists = [];
    const main = readLS(LS_MAIN);
    const backup = readLS(LS_BACKUP);
    if (main?.appointments) lists.push(main.appointments);
    if (backup?.appointments) lists.push(backup.appointments);

    const idbMain = await idbGet('main');
    if (idbMain?.appointments) lists.push(idbMain.appointments);

    const history = await idbGet('history');
    if (Array.isArray(history)) {
      for (const snap of history) {
        if (snap?.appointments) lists.push(snap.appointments);
      }
    }

    return mergeAppointments(...lists);
  },

  async loadCloud(apiUrl) {
    if (!apiUrl) return { ok: false, offline: true };
    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          tokenMissing: res.status === 503 || data.tokenMissing,
          error: data.error || `Server (${res.status})`,
          appointments: [],
        };
      }
      return {
        ok: true,
        appointments: mergeAppointments(data.appointments || []),
        updatedAt: data.updatedAt || null,
      };
    } catch {
      return { ok: false, error: 'Nema veze', appointments: [] };
    }
  },

  async saveCloud(apiUrl, appointments) {
    if (!apiUrl) return { ok: false, error: 'Otvori preko Vercel linka.' };
    try {
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          tokenMissing: res.status === 503 || data.tokenMissing,
          error: data.error || `Server greška (${res.status})`,
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: navigator.onLine ? 'Nema veze sa serverom' : 'Nema interneta' };
    }
  },
};
