const LS_CACHE = 'termini_github_v6';

let queue = Promise.resolve();
let saving = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sortAppts(list) {
  return [...list].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function cloneList(list) {
  return list.map((a) => ({ ...a }));
}

window.TerminiSave = {
  isSaving() {
    return saving;
  },

  saveCache(appointments, updatedAt) {
    try {
      localStorage.setItem(
        LS_CACHE,
        JSON.stringify({ appointments: cloneList(appointments), updatedAt: updatedAt || Date.now() }),
      );
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

  enqueue(task) {
    const run = () => task();
    queue = queue.then(run, run);
    return queue;
  },

  async loadGithub(apiUrl) {
    if (!apiUrl) return { ok: false, error: 'Nije online link.' };
    try {
      const res = await fetch(`${apiUrl}?t=${Date.now()}`, { cache: 'no-store' });
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
        appointments: sortAppts(data.appointments || []),
        updatedAt: data.updatedAt || 0,
      };
    } catch {
      return { ok: false, error: 'Nema interneta' };
    }
  },

  async saveGithub(apiUrl, appointments) {
    if (!apiUrl) return { ok: false, error: 'Nije online link.' };
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

  async loadInitial(apiUrl) {
    return this.enqueue(async () => {
      const cached = this.loadCache();

      if (!apiUrl) {
        return { ok: true, appointments: cached.appointments, updatedAt: cached.updatedAt, source: 'cache' };
      }

      const remote = await this.loadGithub(apiUrl);
      if (!remote.ok) {
        return {
          ok: true,
          appointments: cached.appointments,
          updatedAt: cached.updatedAt,
          source: 'cache',
          offline: true,
          error: remote.error,
        };
      }

      if ((cached.updatedAt || 0) > (remote.updatedAt || 0) && cached.appointments.length > 0) {
        saving = true;
        const push = await this.saveGithub(apiUrl, cached.appointments);
        saving = false;
        if (push.ok) {
          return { ok: true, appointments: cached.appointments, updatedAt: push.updatedAt, source: 'recovery' };
        }
      }

      this.saveCache(remote.appointments, remote.updatedAt);
      return {
        ok: true,
        appointments: remote.appointments,
        updatedAt: remote.updatedAt,
        source: 'github',
      };
    });
  },

  async save(apiUrl, appointments) {
    return this.enqueue(async () => {
      saving = true;
      const snapshot = sortAppts(cloneList(appointments));
      const localAt = Date.now();
      this.saveCache(snapshot, localAt);

      let last = { ok: false, error: 'Nepoznata greška' };
      for (let i = 0; i < 3; i++) {
        last = await this.saveGithub(apiUrl, snapshot);
        if (last.ok) {
          this.saveCache(snapshot, last.updatedAt);
          saving = false;
          return last;
        }
        if (last.notConfigured) break;
        await sleep(400 * (i + 1));
      }

      saving = false;
      return last;
    });
  },

  async refresh(apiUrl) {
    if (saving) return { ok: false, error: 'Sačekaj da se završi čuvanje.' };
    return this.enqueue(async () => this.loadGithub(apiUrl));
  },
};
