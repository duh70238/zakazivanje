const LS_CACHE = 'termini_github_v5';

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

  saveCache(appointments, updatedAt) {
    try {
      localStorage.setItem(LS_CACHE, JSON.stringify({ appointments, updatedAt: updatedAt || Date.now() }));
    } catch { /* ignore */ }
  },

  loadCache() {
    try {
      const raw = localStorage.getItem(LS_CACHE);
      if (!raw) return { appointments: [], updatedAt: 0 };
      const data = JSON.parse(raw);
      return {
        appointments: Array.isArray(data.appointments) ? data.appointments : [],
        updatedAt: data.updatedAt || 0,
      };
    } catch {
      return { appointments: [], updatedAt: 0 };
    }
  },

  async loadGithub(apiUrl) {
    if (!apiUrl) return { ok: false, error: 'Otvori sajt preko interneta (ne kao fajl).' };
    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          notConfigured: res.status === 503,
          error: data.error || `Server (${res.status})`,
        };
      }
      return {
        ok: true,
        appointments: data.appointments || [],
        updatedAt: data.updatedAt || null,
      };
    } catch {
      return { ok: false, error: 'Nema interneta' };
    }
  },

  async saveGithub(apiUrl, appointments) {
    if (!apiUrl) return { ok: false, error: 'Otvori sajt preko interneta.' };
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
          notConfigured: res.status === 503,
          error: data.error || `Server (${res.status})`,
        };
      }
      return { ok: true, updatedAt: data.updatedAt || Date.now() };
    } catch {
      return { ok: false, error: navigator.onLine ? 'Nema veze' : 'Nema interneta' };
    }
  },
};
