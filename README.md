# Termini — pouzdano čuvanje podataka

## Kako se čuvaju podaci (automatski)

Svaki put kad dodaš, izmeniš ili obrišeš termin:

| Gde | Šta |
|-----|-----|
| Telefon — glavna kopija | localStorage |
| Telefon — rezerva | localStorage backup |
| Telefon — baza | IndexedDB |
| Telefon — istorija | poslednjih 8 verzija |
| Cloud (Vercel) | primarni fajl |
| Cloud — rezerva | backup fajl |

**Termin se NIKAD ne gubi sa telefona** — čak i ako cloud ne radi, ostaje sačuvan lokalno.

Kad otvoriš app na drugom uređaju, učitava se iz cloud-a i spaja sa lokalnim.

---

## Jedino što moraš da uradiš (2 minuta, jednom)

### Poveži Vercel Blob (cloud — da radi telefon + komp)

1. Idi na [vercel.com](https://vercel.com) → tvoj projekat
2. Tab **Storage**
3. **Create Database** → izaberi **Blob**
4. Klikni **Connect to Project** → izaberi projekat → **Connect**
5. **Deployments** → **Redeploy**

To je sve. **Ne treba** GitHub token, ne treba ručno ništa da kopiraš.

Vercel automatski doda `BLOB_READ_WRITE_TOKEN`.

---

## Provera da radi

Posle redeploy-a:

1. Otvori app na telefonu (Vercel link, ne fajl)
2. Dodaj termin
3. Gore desno treba da piše: **„Sačuvano (telefon + cloud)"** — zelena tačka
4. Otvori isti link na kompu — termin mora biti tu

Ako piše **žuto „Sačuvano na telefonu"** — cloud nije povezan, uradi korake gore.

---

## Važno za tebe

- Uvek otvaraj **isti Vercel link** (Home Screen ikonica)
- **Ne briši** podatke sajta u Safari podešavanjima
- Jednom mesečno: **Izvezi backup** (dugme na dnu app-a) — dodatna sigurnost

---

## Ako imaš stare termine samo na telefonu

1. Poveži Blob (gore)
2. Otvori app na telefonu — termini će se pojaviti
3. App će ih automatski poslati u cloud

GitHub više **nije potreban** — možeš obrisati `GITHUB_TOKEN` i ostale GitHub promenljive sa Vercel-a.
