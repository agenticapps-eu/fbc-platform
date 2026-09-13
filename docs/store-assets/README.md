# Store-Material — Screenshots und Feature-Grafik

Erzeugt am **2026-09-13** gegen den **lokalen Supabase-Stack** mit erfundenen
Demo-Daten. Kein einziges Bild zeigt echte Mitglieder.

## Was hier liegt

| Ordner / Datei | Format | Wofür |
| --- | --- | --- |
| `ios-6.9/` | 1290 × 2796 | App Store Connect, Pflichtgröße „iPhone 6,9″" |
| `play-telefon/` | 1080 × 1920 (9:16) | Play Console, Telefon-Screenshots |
| `play-feature-graphic.png` | 1024 × 500 | Play Console, **Pflichtfeld** „Feature graphic" |

Je fünf Bildschirme: Aktivität (Feed) · Mitglieder (Verzeichnis) · Events ·
Profil · Nachrichten. Beide Stores nehmen mindestens zwei, Apple bis zu zehn,
Google bis zu acht.

> ⚠️ **Auf dem Profil-Screenshot ist der Knopf „Mitgliedschaft verwalten" zu
> sehen.** Er führt nach `/mitgliedschaft` und von dort zu Stripe. Solange die
> Entscheidung zu Richtlinie 3.1.1 nicht gefallen ist
> (`docs/store-datenschutzangaben.md`, Befund 2), sollte dieses Bild **nicht**
> an Apple gehen — oder der Knopf vorher verschwinden und das Bild neu
> entstehen.

## Warum die Bilder keine echten Personen zeigen

Drei Eingriffe, jeder bewusst und nachgemessen:

1. **Alle 27 Profilbilder entfernt.** Der Demo-Seed setzt `avatar_url` auf
   `i.pravatar.cc` — das liefert **Fotos echter Menschen** unter erfundenen
   Namen. `update public.profiles set avatar_url = null`, danach zeigt die App
   Monogramme, und das sieht nicht nach Lücke aus.
2. **„DEMO-Profil — fiktive Daten." aus 27 Kurzbios entfernt.** In einem
   Store-Eintrag liest sich das wie eine unfertige App.
3. **Titelbilder aus `public/images/`** (eigene Motive, Unsplash-Lizenz, siehe
   `public/images/CREDITS.md`), auf 3:1 zugeschnitten — das Seitenverhältnis der
   Kachel. Die Seitenköpfe sind 3:2; roh eingesetzt stehen sie mit grauen
   Rändern im Feld:

   ```bash
   mkdir -p public/images/.sichtprobe        # danach WIEDER LOESCHEN, public/ wird ausgeliefert
   for f in hero-see hero-start hero-mitglieder hero-kontakte hero-academy hero-compass; do
     sips -s format png public/images/$f.webp --out /tmp/$f.png
     w=$(sips -g pixelWidth /tmp/$f.png | awk '/pixelWidth/{print $2}')
     sips -c $((w/3)) $w /tmp/$f.png --out public/images/.sichtprobe/$f.png
   done
   ```

   Danach in der Datenbank `cover_url` auf
   `http://localhost:5209/images/.sichtprobe/<datei>.png` setzen — **mit
   Schema**, siehe die dritte Falle unten.

Der Hinweis „Testumgebung — Daten sind nicht echt" ist **nur für die Aufnahme**
per CSS ausgeblendet. Die lokale Umgebung als `prod` auszugeben wäre eine Lüge
in einer Datei, die liegen bleiben kann.

## Neu erzeugen

Beide Skripte brauchen `playwright-core` (nicht im Projekt — bewusst, es ist
Einmalwerkzeug) und eine lokale vite-Instanz.

```bash
supabase start
DEMO_SEED_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable" \
  DEMO_SEED_CONFIRM=fbc-demo npx tsx supabase/seed/demo_seed.ts
# danach: Avatare abraeumen, Bios saeubern, ein Konto aktivieren — siehe oben
pnpm exec vite --port 5209 --strictPort      # NICHT `pnpm dev` (schoebe Infisical davor)
S=$(mktemp -d) && npm --prefix "$S" install playwright-core
S=$S node scripts/store-screenshots.mjs
S=$S node scripts/store-feature-graphic.mjs
```

**Drei Fallen, alle erlebt:**

- **Der Seed erwartet drei Konten, die er nicht anlegt** (`discover@`, `prime@`,
  `legacy@fbcdemo.com`). Fehlen sie, bricht er an einem Fremdschlüssel auf
  `profile_contacts` ab. Vorher per SQL in `auth.users` anlegen.
- **Der Opt-in-Wächter des Seeds prüft den Zielhost nicht.** Er warnt wörtlich
  „This is the LIVE shared Supabase project", egal wohin er zeigt. Verlassen
  kann man sich nur auf die Zeile `Target Postgres:` darüber.
- **`cover_url` ist seit `bild_pfade_statt_urls` ein Speicherpfad, keine URL.**
  Ein Wert ohne URI-Schema landet im Bucket-Pfad und bricht als Bildplatzhalter.
  Wer eine lokale Datei einsetzen will, braucht `http://…` davor.

Das Aufnahmeskript **bricht ab**, wenn die Anmeldung nicht greift, und markiert
jede Seite, auf der noch „Anmelden" im Kopf steht. Beim ersten Lauf war genau
das der Fall: `/` trägt kein Anmeldeformular, es liegt auf `/login` — die Bilder
zeigten die ausgeloggte Sicht mit „Ein Mitglied" statt Namen, und ohne diese
Prüfung wäre das erst im Store aufgefallen.
