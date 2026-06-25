# Termini — Aplikacija za zakazivanje

Podaci se čuvaju u jednom fajlu na GitHub-u: **`data/bookings.json`**

Svaki put kad dodaš, izmeniš ili obrišeš termin, app ažurira taj fajl u tvom repou.

---

## Kako radi

```
Telefon  →  Vercel API  →  GitHub (data/bookings.json)
```

- Jedan fajl = jedna „baza“
- Vidiš ga direktno na GitHub-u u svom folderu
- Git istorija čuva stare verzije (možeš vratiti ako zatreba)
- Commit poruka sadrži `[skip ci]` da se Vercel ne redeploy-uje pri svakom čuvanju

---

## Podešavanje (jednom)

### 1. GitHub repozitorijum

1. Napravi repo na GitHub-u (npr. `termini-salon`)
2. Uploaduj ceo ovaj folder ili push sa kompa

### 2. GitHub token

1. GitHub → **Settings → Developer settings → Personal access tokens**
2. **Generate new token (classic)**
3. Čekiraj samo **`repo`** (pristup repou)
4. Kopiraj token (prikaže se samo jednom!)

### 3. Vercel

1. Importuj repo na [vercel.com](https://vercel.com)
2. U projektu: **Settings → Environment Variables**
3. Dodaj:

| Ime | Vrednost |
|-----|----------|
| `GITHUB_TOKEN` | tvoj token |
| `GITHUB_OWNER` | tvoje GitHub korisničko ime |
| `GITHUB_REPO` | ime repoa (npr. `termini-salon`) |

Opciono: `GITHUB_FILE` = `data/bookings.json` (podrazumevano)

4. **Redeploy** projekat

### 4. Na telefonu

- Otvori Vercel link
- **Add to Home Screen** iz Safari-ja

---

## Gde su podaci

Otvori na GitHub-u:

```
tvoj-repo/data/bookings.json
```

Tu vidiš sve termine u JSON formatu. Svaka izmena u app-u ažurira ovaj fajl.

---

## Ako nešto ne radi

- **Crvena tačka** = GitHub nije podešen ili nema interneta
- Proveri da su `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` tačni na Vercel-u
- Token mora imati `repo` dozvolu
- App mora biti otvoren preko Vercel linka, ne kao fajl sa diska

---

## Ručni backup

U app-u na dnu: **Izvezi backup** — preuzme JSON na telefon kao dodatnu kopiju.
