# Komsika — Aplikacija za zakazivanje

Jednostavna mobilna aplikacija za beauty salon. Radi na telefonu, čuva sve rezervacije trajno.

## Funkcije

- Pregled svih termina za dan (slobodni = zeleno, zauzeti = roze)
- Dodavanje termina (ime, prezime, datum, vreme, trajanje)
- Brisanje termina
- Navigacija između dana
- Automatsko čuvanje na server + lokalni backup
- Ručni export/import backup (JSON)

## Deploy na Vercel

### 1. Upload projekta

1. Idi na [vercel.com](https://vercel.com) i uloguj se
2. Klikni **Add New → Project**
3. Importuj ovaj folder (ili push na GitHub pa import)

### 2. Podesi Blob storage (OBAVEZNO za trajno čuvanje)

Bez ovoga podaci ostaju samo na telefonu (localStorage).

1. U Vercel dashboardu otvori projekat
2. Idi na **Storage → Create Database → Blob**
3. Kreiraj Blob store i poveži ga sa projektom
4. Vercel automatski dodaje `BLOB_READ_WRITE_TOKEN` — ništa ručno ne treba

### 3. Deploy

Klikni **Deploy**. Aplikacija će biti dostupna na `tvoj-projekat.vercel.app`.

### 4. Na telefonu

- Otvori link u browseru (Chrome/Safari)
- Na iPhone: Share → **Add to Home Screen** (kao aplikacija)

## Radno vreme

Podrazumevano: **09:00 – 20:00**, termini na svakih 30 min.

Za promenu, uredi `CONFIG` u `js/app.js`:

```js
const CONFIG = {
  startHour: 9,
  endHour: 20,
  slotStep: 30,
};
```

## Kako se čuvaju podaci

1. **Vercel Blob** — glavno skladište (preživljava redeploy, brisanje keša, itd.)
2. **localStorage** — instant backup na telefonu
3. **JSON export** — ručna rezervna kopija

## Lokalno testiranje

```bash
npm install
npx vercel dev
```

Za lokalni API potreban je `BLOB_READ_WRITE_TOKEN` u `.env` fajlu (kopiraj iz Vercel dashboarda).
