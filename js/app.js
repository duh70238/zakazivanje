const IS_LOCAL_FILE = window.location.protocol === 'file:';
const API_URL = IS_LOCAL_FILE ? null : '/api/bookings';

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
const WEEKDAYS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

let appointments = [];
let selectedDate = todayStr();
let selectedAppointmentId = null;
let editingAppointmentId = null;
let syncPending = false;
let lastSavedAt = null;
let calendarView = { year: 0, month: 0 };

const $ = (id) => document.getElementById(id);
let els = {};

function todayStr() {
  return formatDate(new Date());
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function formatDisplayDate(str) {
  const d = parseDate(str);
  const days = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}.`;
}

function formatSavedAt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function normalizeAppointment(a) {
  if (a.timeEnd) return a;
  if (a.duration) {
    const end = timeToMinutes(a.time) + a.duration;
    const h = Math.floor(end / 60);
    const m = end % 60;
    return { ...a, timeEnd: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
  }
  return { ...a, timeEnd: a.time };
}

function getAppointmentsForDate(date) {
  return appointments
    .filter((a) => a.date === date)
    .map(normalizeAppointment)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function getDatesWithAppointments() {
  const set = new Set();
  for (const a of appointments) set.add(a.date);
  return set;
}

function formatTimeRange(appt) {
  const a = normalizeAppointment(appt);
  return `${a.time} – ${a.timeEnd}`;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function setSyncStatus(status, message) {
  els.syncStatus.className = `sync-badge ${status}`;
  const defaults = {
    synced: 'Sačuvano na GitHub-u',
    pending: 'Upis na GitHub...',
    local: 'Keš na telefonu',
    error: 'GitHub nije podešen',
  };
  const text = message || defaults[status] || '';
  els.syncStatus.title = text;
  if (els.syncText) els.syncText.textContent = text;
}

async function loadFromGithub() {
  return TerminiSave.loadGithub(API_URL);
}

async function persist() {
  if (!API_URL) {
    TerminiSave.saveCache(appointments, Date.now());
    setSyncStatus('error', 'Otvori link sajta');
    return { ok: false, error: 'Nije online link' };
  }

  syncPending = true;
  setSyncStatus('pending');

  const result = await TerminiSave.saveGithub(API_URL, appointments);
  syncPending = false;

  if (result.ok) {
    lastSavedAt = result.updatedAt;
    TerminiSave.saveCache(appointments, lastSavedAt);
    setSyncStatus('synced', `✓ Na GitHub-u (${appointments.length})`);
    return { ok: true };
  }

  TerminiSave.saveCache(appointments, Date.now());
  setSyncStatus(result.notConfigured ? 'error' : 'local', result.error);
  return { ok: false, error: result.error };
}

async function initData() {
  const cached = TerminiSave.loadCache();

  if (API_URL) {
    try {
      const st = await fetch('/api/status', { cache: 'no-store' });
      const status = await st.json();
      if (!status.ok) {
        appointments = cached;
        setSyncStatus('error', status.message || 'Podesi GitHub na Vercel-u');
        return;
      }
    } catch { /* nastavi */ }
  }

  const remote = await loadFromGithub();

  if (remote.ok) {
    appointments = TerminiSave.mergeAppointments(cached, remote.appointments);
    lastSavedAt = remote.updatedAt;
    TerminiSave.saveCache(appointments, lastSavedAt);
    setSyncStatus('synced', `✓ Na GitHub-u (${appointments.length})`);
  } else if (cached.length > 0) {
    appointments = cached;
    setSyncStatus('local', remote.error || 'Keš na telefonu');
  } else {
    appointments = [];
    setSyncStatus('error', remote.error || 'Podesi GitHub + Redeploy');
  }
}

function render() {
  const isToday = selectedDate === todayStr();
  els.dateLabel.textContent = isToday ? 'Danas' : formatDisplayDate(selectedDate);
  els.goToday.hidden = isToday;

  const dayAppts = getAppointmentsForDate(selectedDate);
  els.apptCount.textContent = dayAppts.length;

  els.slotsList.innerHTML = '';

  if (dayAppts.length === 0) {
    els.slotsList.innerHTML = `
      <div class="empty-day">
        <p>Nema zakazanih termina za ovaj dan.</p>
        <p class="empty-hint">Pritisni + da dodaš termin.</p>
      </div>`;
    renderBackupBar();
    return;
  }

  for (const appt of dayAppts) {
    const div = document.createElement('div');
    div.className = 'slot slot-busy';
    const desc = appt.description ? `<div class="slot-desc">${escapeHtml(appt.description)}</div>` : '';
    div.innerHTML = `
      <span class="slot-time">${appt.time}</span>
      <div class="slot-info">
        <span class="slot-range">${formatTimeRange(appt)}</span>
        <div class="slot-name">${escapeHtml(appt.firstName)} ${escapeHtml(appt.lastName)}</div>
        ${desc}
      </div>
      <span class="slot-arrow">›</span>
    `;
    div.addEventListener('click', () => openDetail(appt.id));
    els.slotsList.appendChild(div);
  }

  renderBackupBar();
}

function renderBackupBar() {
  let bar = document.querySelector('.backup-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'backup-bar';
    els.slotsList.after(bar);
  }
  const saved = lastSavedAt ? `Poslednje čuvanje: ${formatSavedAt(lastSavedAt)}` : '';
  bar.innerHTML = `
  <div class="save-info">
    <strong>Baza = fajl na GitHub-u:</strong> <code>data/bookings.json</code>
    ${saved ? `<br><span>${saved}</span>` : ''}
  </div>
  Ručna kopija:
  <br>
  <button type="button" id="exportBtn">Izvezi backup</button>
  <button type="button" id="importBtn">Uvezi backup</button>
  <input type="file" id="importFile" accept=".json" hidden>
  `;
  bar.querySelector('#exportBtn').addEventListener('click', exportBackup);
  bar.querySelector('#importBtn').addEventListener('click', () => bar.querySelector('#importFile').click());
  bar.querySelector('#importFile').addEventListener('change', importBackup);
}

function openCalendar() {
  const d = parseDate(selectedDate);
  calendarView = { year: d.getFullYear(), month: d.getMonth() };
  renderCalendar();
  showModal(els.calendarOverlay);
}

function closeCalendar() {
  hideModal(els.calendarOverlay);
}

function renderCalendar() {
  const { year, month } = calendarView;
  els.calendarTitle.textContent = `${MONTHS[month]} ${year}`;

  els.calendarWeekdays.innerHTML = WEEKDAYS.map((d) => `<span>${d}</span>`).join('');

  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  let startPad = first.getDay() - 1;
  if (startPad < 0) startPad = 6;

  const datesWithAppts = getDatesWithAppointments();
  const today = todayStr();
  els.calendarGrid.innerHTML = '';

  for (let i = 0; i < startPad; i++) {
    const empty = document.createElement('span');
    empty.className = 'cal-day cal-empty';
    els.calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = day;

    if (dateStr === today) btn.classList.add('cal-today');
    if (dateStr === selectedDate) btn.classList.add('cal-selected');
    if (datesWithAppts.has(dateStr)) btn.classList.add('cal-has-appt');

    btn.addEventListener('click', () => {
      selectedDate = dateStr;
      closeCalendar();
      render();
    });
    els.calendarGrid.appendChild(btn);
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { els.toast.hidden = true; }, 2500);
}

function showModal(el) {
  el.removeAttribute('hidden');
}

function hideModal(el) {
  el.setAttribute('hidden', '');
}

function openAddModal() {
  editingAppointmentId = null;
  els.modalTitle.textContent = 'Novi termin';
  els.bookingForm.reset();
  els.bookingDate.value = selectedDate;
  const now = new Date();
  els.startTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  els.endTime.value = '';
  els.description.value = '';
  showModal(els.modalOverlay);
  els.firstName.focus();
}

function openEditModal(id) {
  const appt = appointments.find((a) => a.id === id);
  if (!appt) return;
  const normalized = normalizeAppointment(appt);
  editingAppointmentId = id;
  els.modalTitle.textContent = 'Izmeni termin';
  els.firstName.value = normalized.firstName;
  els.lastName.value = normalized.lastName;
  els.bookingDate.value = normalized.date;
  els.startTime.value = normalized.time;
  els.endTime.value = normalized.timeEnd;
  els.description.value = normalized.description || '';
  hideModal(els.detailOverlay);
  showModal(els.modalOverlay);
  els.firstName.focus();
}

function closeAddModal() {
  hideModal(els.modalOverlay);
  editingAppointmentId = null;
}

function openDetail(id) {
  const appt = appointments.find((a) => a.id === id);
  if (!appt) return;
  const normalized = normalizeAppointment(appt);
  selectedAppointmentId = id;
  els.detailName.textContent = `${normalized.firstName} ${normalized.lastName}`;
  els.detailTime.textContent = formatDisplayDate(normalized.date);
  els.detailRange.textContent = formatTimeRange(normalized);
  els.detailDesc.textContent = normalized.description || '';
  els.detailDesc.hidden = !normalized.description;
  showModal(els.detailOverlay);
}

function closeDetailModal() {
  hideModal(els.detailOverlay);
  selectedAppointmentId = null;
}

async function saveAppointment(e) {
  e.preventDefault();

  const firstName = els.firstName.value.trim();
  const lastName = els.lastName.value.trim();
  const date = els.bookingDate.value;
  const time = els.startTime.value;
  const timeEnd = els.endTime.value;
  const description = els.description.value.trim();

  if (!firstName || !lastName || !date || !time || !timeEnd) {
    showToast('Popuni ime, prezime, datum i vreme.');
    return;
  }

  if (timeToMinutes(timeEnd) <= timeToMinutes(time)) {
    showToast('Kraj mora biti posle početka.');
    return;
  }

  const apptData = {
    firstName,
    lastName,
    date,
    time,
    timeEnd,
    description,
    updatedAt: Date.now(),
  };

  if (editingAppointmentId) {
    const idx = appointments.findIndex((a) => a.id === editingAppointmentId);
    if (idx !== -1) appointments[idx] = { ...appointments[idx], ...apptData };
    closeAddModal();
    if (date !== selectedDate) selectedDate = date;
    render();
    const result = await persist();
    showToast(result.ok ? 'Termin izmenjen ✓' : `Greška: ${result.error}`);
  } else {
    appointments.push({ id: uuid(), ...apptData });
    closeAddModal();
    if (date !== selectedDate) selectedDate = date;
    render();
    const result = await persist();
    showToast(result.ok ? 'Termin sačuvan ✓' : `Nije na GitHub-u! ${result.error}`);
  }
}

async function deleteAppointment() {
  if (!selectedAppointmentId) return;
  if (!confirm('Da li sigurno želiš da obrišeš ovaj termin?')) return;

  appointments = appointments.filter((a) => a.id !== selectedAppointmentId);
  closeDetailModal();
  render();
  const result = await persist();
  showToast(result.ok ? 'Termin obrisan' : `Greška: ${result.error}`);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ appointments, exportedAt: Date.now() }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `termini-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup preuzet');
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.appointments)) throw new Error('Invalid');
    appointments = data.appointments.map(normalizeAppointment);
    render();
    const result = await persist();
    showToast(result.ok ? 'Backup uvezen ✓' : `Greška: ${result.error}`);
  } catch {
    showToast('Neispravan backup fajl');
  }
  e.target.value = '';
}

function bindEvents() {
  els.prevDay.addEventListener('click', () => {
    selectedDate = addDays(selectedDate, -1);
    render();
  });

  els.nextDay.addEventListener('click', () => {
    selectedDate = addDays(selectedDate, 1);
    render();
  });

  els.goToday.addEventListener('click', () => {
    selectedDate = todayStr();
    render();
  });

  els.openCalendar.addEventListener('click', openCalendar);
  els.closeCalendar.addEventListener('click', closeCalendar);
  els.prevMonth.addEventListener('click', () => {
    calendarView.month -= 1;
    if (calendarView.month < 0) {
      calendarView.month = 11;
      calendarView.year -= 1;
    }
    renderCalendar();
  });
  els.nextMonth.addEventListener('click', () => {
    calendarView.month += 1;
    if (calendarView.month > 11) {
      calendarView.month = 0;
      calendarView.year += 1;
    }
    renderCalendar();
  });
  els.calendarOverlay.addEventListener('click', (e) => {
    if (e.target === els.calendarOverlay) closeCalendar();
  });

  els.addBtn.addEventListener('click', () => openAddModal());
  els.cancelBtn.addEventListener('click', closeAddModal);
  els.bookingForm.addEventListener('submit', saveAppointment);
  els.closeDetail.addEventListener('click', closeDetailModal);
  els.editBtn.addEventListener('click', () => {
    if (selectedAppointmentId) openEditModal(selectedAppointmentId);
  });
  els.deleteBtn.addEventListener('click', deleteAppointment);

  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay) closeAddModal();
  });
  els.detailOverlay.addEventListener('click', (e) => {
    if (e.target === els.detailOverlay) closeDetailModal();
  });

  window.addEventListener('online', () => {
    if (!syncPending) persist();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initData().then(render);
    }
  });

  setInterval(() => {
    if (!syncPending && API_URL && navigator.onLine && appointments.length) {
      TerminiSave.saveGithub(API_URL, appointments);
    }
  }, 3 * 60 * 1000);
}

function cacheElements() {
  els = {
    syncStatus: $('syncStatus'),
    syncText: $('syncText'),
    dateLabel: $('dateLabel'),
    openCalendar: $('openCalendar'),
    modalTitle: $('modalTitle'),
    prevDay: $('prevDay'),
    nextDay: $('nextDay'),
    goToday: $('goToday'),
    apptCount: $('apptCount'),
    slotsList: $('slotsList'),
    addBtn: $('addBtn'),
    modalOverlay: $('modalOverlay'),
    detailOverlay: $('detailOverlay'),
    calendarOverlay: $('calendarOverlay'),
    calendarTitle: $('calendarTitle'),
    calendarWeekdays: $('calendarWeekdays'),
    calendarGrid: $('calendarGrid'),
    prevMonth: $('prevMonth'),
    nextMonth: $('nextMonth'),
    closeCalendar: $('closeCalendar'),
    bookingForm: $('bookingForm'),
    firstName: $('firstName'),
    lastName: $('lastName'),
    bookingDate: $('bookingDate'),
    startTime: $('startTime'),
    endTime: $('endTime'),
    description: $('description'),
    cancelBtn: $('cancelBtn'),
    detailName: $('detailName'),
    detailTime: $('detailTime'),
    detailRange: $('detailRange'),
    detailDesc: $('detailDesc'),
    closeDetail: $('closeDetail'),
    editBtn: $('editBtn'),
    deleteBtn: $('deleteBtn'),
    toast: $('toast'),
  };
}

async function init() {
  cacheElements();
  bindEvents();
  await initData();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
