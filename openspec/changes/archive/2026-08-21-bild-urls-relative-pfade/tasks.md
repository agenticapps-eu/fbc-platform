> **Diese Change wird in ZWEI PRs ausgeliefert, mit einem Deploy dazwischen.**
> Der Grund steht in `REVIEWS.md` (HIGH 1) und in `design.md`: ein altes Bundle,
> das einen nackten Pfad bekommt, rendert `<img src="uid/123.webp">` relativ zum
> Anwendungs-Origin — ein totes Bild auf der ganzen Fläche. Der Leser muss
> **vor** dem Schreiber draußen sein.

## Stufe 1 — Nur Leser. Für sich folgenlos.

Nach Stufe 1 ändert sich nichts Beobachtbares: alle Bestandswerte sind absolut
und werden durchgereicht. Genau das macht sie sicher auslieferbar.

### 1. Der Auflöser (TDD, rot vor grün)

- [x] 1.1 Testliste **zuerst**, jeder Fall erst rot:
      nackter Pfad → Host + Bucket davor ·
      `https://…` → unverändert ·
      **`http://127.0.0.1:54321/…` → unverändert** (der lokale Stack, Port aus
      `supabase/config.toml:10` — eine Scheme-Whitelist hätte ihn beschädigt) ·
      `blob:…` → unverändert ·
      `https://i.pravatar.cc/…` → unverändert (der Demo-Seed schreibt das) ·
      `null` → `null` · richtiger Bucket je Spalte.
- [x] 1.2 **„Absolut" heisst: trägt ein URI-Schema.** Keine Liste erlaubter
      Schemata — eine Liste ist genau das, was `http:` übersehen hat.
- [x] 1.3 `bildUrl(bucket, wert)` als **reine** Funktion. Kein `async`, keine
      Lookup-Map: beide Buckets sind öffentlich.
- [x] 1.4 Grün, und **Gegenprobe**: eine Verbiegung der Funktion muss mindestens
      einen Test rot machen. Wo eine Verbiegung grün bleibt, fehlt ein Test.
      (Der Commit davor muss stehen — `git checkout` und `git stash` verwerfen
      ungesicherte Korrekturen.)

### 2. Die drei Anzeigestellen

- [x] 2.1 `src/components/ui/Avatar.tsx` — deckt alle Profilbilder ab,
      einschließlich `ProfilPage:262`.
- [x] 2.2 `src/components/profile/ProfileHero.tsx` — Hintergrundbild.
- [x] 2.3 `src/pages/ProfilPage.tsx:287` — Cover-Vorschau, rendert an
      `ProfileHero` **vorbei**.
- [x] 2.4 Vollständigkeit als **Suche**, nicht als Augenschein (gemini): kein
      `<img src>` und kein `url(...)` ausserhalb dieser drei bindet
      `avatar_url`/`cover_url`.

### 3. Sichtprobe im Browser — nicht verhandelbar

- [x] 3.1 `blob:` ist in jsdom unsichtbar, weil jsdom kein Bild lädt. Die
      Vorschau beim Hochladen **im Browser** ansehen, Profilbild und
      Hintergrundbild je einmal.
- [x] 3.2 Verzeichnis, Profilansicht und Aktivität mit echten Daten — grüne
      Tests haben hier schon ein visuell falsches Ergebnis durchgewunken.

### 4. Stufe 1 ausliefern

- [x] 4.1 `pnpm test`, `typecheck`, `lint` — Ausgaben lesen.
- [x] 4.2 Code-Review auf den **Diff**.
- [x] 4.3 PR, Merge per `gh pr view --json state` gegengeprüft.
- [x] 4.4 **Am ausgelieferten Bundle belegen, dass Stufe 1 live ist** — an einer
      Zeichenkette aus dem Diff, nicht an der Bundle-Größe. Erst danach Stufe 2.

## Stufe 2 — Erzeuger und Migration. Erst wenn Stufe 1 nachweislich live ist.

### 5. Die Erzeuger schreiben Pfade

- [x] 5.1 `uploadBild` (`src/lib/profile.ts:311`) gibt den Pfad zurück.
- [x] 5.2 **Und kanonisiert beim Speichern**: ein eingehender absoluter
      Supabase-Wert wird zum Pfad. Das schließt die Nachzügler —
      `uploadBild` gibt ohne neuen Blob den ALTEN Wert zurück (`:305`), und
      `saveProfile` (`:343`) wie `admin-profile.ts:170` schreiben ihn
      bedingungslos zurück.
- [x] 5.3 `supabase/seed/wp_bilder.ts` — **Prüf-URL und persistierten Pfad
      trennen.** Die absolute URL wird für den `HEAD`-Check auf vorhandene
      Objekte weiter gebraucht (`:490`); nur der Rückgabewert wird zum Pfad.
      Alle drei Zweige einzeln testen: hochgeladen · vorhanden via `HEAD` ·
      vorhanden via 409.

### 6. Die Migration

- [x] 6.1 **Nur umschneiden, wenn das Objekt lokal existiert** — gegen
      `storage.objects` mit passendem `bucket_id` und `name`. Damit ist sie
      weder an eine Projektkennung gebunden noch je zu breit, und das Szenario
      „fremde Werte bleiben unangetastet" hält auch gegen ein fremdes
      Supabase-Projekt mit gleichnamigem Bucket.
- [x] 6.2 Jede Spalte nur gegen ihren eigenen Bucket.
- [x] 6.3 Migrations-Kopf mit Begründung und **verworfener Alternative** (das
      harte Schreiben der Kennung, und warum die Existenzprüfung besser ist).
- [x] 6.4 **Automatisierter** Migrationstest, nicht ein Handlauf: eigener Host ·
      fremder Supabase-Host mit gleichem Bucket · falscher Bucket · nackter
      Pfad · `null` · **Idempotenz** · ein nach der Migration geschriebener
      Altwert.
- [x] 6.5 Lokal gegen `supabase start` fahren und die Wirkung zählen.

### 7. Abschluss

- [ ] 7.1 Zählen: `avatar_url`/`cover_url` mit Projektkennung → **0**.
- [x] 7.2 Sichtprobe im Browser, dass die Bilder danach wirklich da sind — eine
      Zeilenzählung sagt darüber nichts.
- [ ] 7.3 `openspec archive`, danach erneut `validate --all`.
- [ ] 7.4 PR, Merge gegengeprüft; Linear-Status lesen, nicht blind schreiben.
