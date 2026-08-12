# Tasks — C8 (AGE-531)

**Fassung 2**, nach dem Fremd-Review (`REVIEWS.md`, gemini + codex, beide
REQUEST-CHANGES). Was sich gegenüber Fassung 1 geändert hat, steht dort mit
Begründung; die Aufgaben unten sind die eingearbeitete Form.

Reihenfolge ist Absicht: erst die Datenbank, dann die Datenschicht, dann die
Oberfläche — und innerhalb jedes Blocks der rote Test vor dem Code. Jede
Aufgabe nennt, **woran man sieht, dass sie erfüllt ist**.

Entwickelt und geprüft wird **lokal** (`supabase start`) und gegen **DEV**
(`foelowldexkcqzewvrcf`). Nicht gegen PROD. Kein `db reset` gegen ein
Remote-Projekt. Vor jedem schreibenden Befehl das Zielprojekt nennen.

Der Testbefehl nimmt **positionale Pfade**, kein `--file`:

```
supabase test db --local supabase/tests/rls_test.sql supabase/tests/grants_test.sql
```

Ohne die Pfadliste meldet er FAIL, obwohl grün — die `probe_*.sql` sind kein
pgTAP.

Fallen, die in diesem Repo schon zugeschlagen haben und hier wieder greifen:

- **`database.types.ts` von Hand ergänzen**, nicht neu generieren. Die CLI
  schreibt die Datei stillos um und bricht rund zwanzig Testfixtures — dieselbe
  Entscheidung wie AGE-249/AGE-358/AGE-498/AGE-528.
- **Ohne SELECT-Policy trifft ein `where` auf `storage.objects` 0 Zeilen**,
  auch bei `using(true)`. Ein Test, der „0 Zeilen" mit „verboten" verwechselt,
  ist grün und prüft nichts. Verweigerte Fälle über den **Fehler** belegen.
- **`pgTAP` kennt kein `like()`** — `alike()`. Und `try_as()` meldet jeden
  Fehler als DENIED, auch einen Tippfehler.
- **Eine Funktion ist per Voreinstellung für `PUBLIC` ausführbar.** Ohne
  `revoke` ist jede neue Funktion eine stille Rechteausweitung.
- **Nie `git add -A`.** Der Arbeitsbaum trägt dauerhaft untrackte Dateien mit
  Rechten 0600, und das Repo ist öffentlich.
- **`fixed`-Overlays gehören in ein Portal an `document.body`.** `.fbc-card:hover`
  setzt einen `transform`, und darunter schrumpft jedes `position: fixed` auf
  die Karte. jsdom sieht das nie.

---

## 0 · Vorbereitung

- [x] 0.1 `openspec validate --all` grün, bevor die erste Zeile Code entsteht.
- [x] 0.2 Fremd-Review (Schritt 2b) → `REVIEWS.md`. gemini und codex, beide
      andere Anbieter als der Verfasser. **`REVIEWER_TIMEOUT=900`** — mit der
      Voreinstellung von 300 s wäre codex als exit 4 durchgefallen und hätte
      nicht gezählt. Befunde eingearbeitet (Fassung 2).
- [x] 0.3 Branch
      `donald/age-531-c8-events-beschreibung-vonbis-titelbild-themen-teilnehmer`
      von `main`.
- [x] 0.4 Lokaler Stack hochgefahren, `supabase db reset` **nur lokal**.
- [x] 0.5 Beide Mockups liegen als Originale unter
      `docs/mockups/eventuebersicht-2026-07-29.png` und
      `docs/mockups/event-detail-2026-07-29.png`.
- [x] 0.6 **Ausgangsmessung**: `pnpm test` 615 Tests in 90 Dateien grün;
      `supabase test db --local` 315 Tests grün (`rls_test` steht auf
      `plan(310)`, `grants_test` auf `plan(5)`).
- [x] 0.7 **PROD-Vorabmessung** (Befund codex, MEDIUM), read-only:
      `scripts/probe-c8-starts-at-preflight.ts` gegen
      `viwntbodrtqxgmqyxluh`. Ergebnis: **0 Events**, also 0 ohne Termin;
      `events_visibility_check` dort ebenfalls bereits sauber. `set not null`
      läuft in PROD durch — gemessen, nicht angenommen.

## 1 · Migration A — die vier Spalten und die Pfadbindung

Datei: `supabase/migrations/20260812100000_events_content.sql`

Der Kopf trägt die Entscheidung mit Begründung und verworfener Alternative — in
diesem Repo stehen Entscheidungen in Migrations-Köpfen, nicht nur im Change.

- [x] 1.1 **RED**: Fälle in `supabase/tests/rls_test.sql`, alle rot: - `insert` ohne `starts_at` → abgelehnt - `ends_at <= starts_at` → abgelehnt - `ends_at is null` bei gesetztem `starts_at` → angenommen - zwei Events mit demselben `cover_path` → abgelehnt - **`cover_path` mit fremdem Präfix → abgelehnt** (Befund codex, HIGH) - `cover_path = null` → angenommen
      `plan()` mitziehen.
- [x] 1.2 Spalten anlegen: `description text`, `ends_at timestamptz`,
      `cover_path text`, `topics text[]`.
- [x] 1.3 `unique (cover_path)`. Begründung im Kopf: `event_cover_lesbar`
      schlägt das Event über genau diese Spalte nach; zwei Zeilen auf denselben
      Pfad machten die Antwort mehrdeutig — dieselbe Falle wie bei
      `post_media.storage_path`.
- [x] 1.4 **`events_write_host` um die Pfadbindung erweitern**: im `with_check`
      zusätzlich `cover_path is null or split_part(cover_path, '/', 1) =
(select auth.uid())::text`. Das ist die schreibende Hälfte des
      HIGH-Befunds. Der Kopf beschreibt den Angriff, den sie schließt — wörtlich
      derselbe, den C7 in `create_post_with_media`
      (`20260812090000_post_media.sql:214–240`) abwehrt: fremden Pfad merken,
      auf das Verwaisen warten, an ein eigenes `public`-Event hängen.
      **`is_activated()` bleibt äußeres `AND`** — die Policy darf dabei nicht
      ihre Gate-Form verlieren.
- [x] 1.5 `alter column starts_at set not null`. DEV: 9/0, PROD: 0/0 (0.7).
- [x] 1.6 `check (ends_at is null or ends_at > starts_at)`.
- [x] 1.7 **Keine** Änderung an `events_visibility_check`. Die toten Werte
      `prime`/`legacy` sind seit `20260715150000_six_level_model.sql:284–287`
      raus; gemessen in DEV **und** PROD. Die Aufgabe aus AGE-531 entfällt —
      als bewusste Auslassung in den Migrations-Kopf, damit der nächste Leser
      nicht erneut danach sucht.
- [x] 1.8 **GREEN**: 1.1 läuft. Zusätzlich `grants_test.sql` ausführen und die
      Ausgabe **lesen** — Erwartung grün (keine neue Tabelle; die
      Spalten-Grants-Assertion führt `events` nicht), aber dieser Snapshot ist
      in AGE-455 schon einmal ohne Namensnennung rot geworden.
- [x] 1.9 `database.types.ts` von Hand ergänzen: die vier neuen Spalten **und**
      die Nullbarkeit von `starts_at` an **drei** Stellen — `Row.starts_at:
string`, `Insert.starts_at` verpflichtend, `Update.starts_at?: string`
      ohne `| null` (Befund codex, MEDIUM). Ohne das nimmt der Typvertrag
      weiterhin genau den Schreibzugriff an, den die Migration verbietet.

## 2 · Migration B — `event_attendees`

Datei: `supabase/migrations/20260812100100_event_attendees.sql`

**`regs_select_self_or_host` wird nicht angefasst.** Das ist der Kern der
Entscheidung: das Aktivierungs-Gate aus C3 bleibt an der Stelle stehen, an der
es gesetzt wurde, und `rating`/`checked_in` fremder Zeilen bleiben unlesbar.

- [x] 2.1 **RED**: Fälle in `rls_test.sql`, alle rot: - aktiviertes Mitglied, sichtbares Event, nicht Host → alle
      `registered` Teilnehmer **mit öffentlichem Profil** - **eingeloggt, nicht aktiviert → leer** (der Fall, den AGE-531
      ausdrücklich verlangt) - **Teilnehmer mit `is_public = false` → gar nicht enthalten**
      (Befund codex, HIGH — geprüft wird die ROHE Antwort, nicht das Label) - `cancelled` und `waitlist` → für den Nicht-Host nicht enthalten - Host → alle Status - ohne Session → kein `execute` (Fehler, nicht „0 Zeilen") - **Regression:** direkter `select` auf `event_registrations` als
      Nicht-Host liefert weiterhin **nur die eigene Zeile**
- [x] 2.2 Funktion anlegen: `security definer`, `stable`,
      `set search_path = ''`, Rückgabe `table (profile_id uuid, status text)`,
      Sortierung nach `created_at`.
- [x] 2.3 Gate, Sichtbarkeit und Opt-out **in der Funktion**:
      `public.is_activated()`; Event sichtbar
      (`visibility in ('public','members')` oder `host_id = auth.uid()`);
      Nicht-Host nur `status = 'registered'`; und ein Join auf
      `public.profiles` mit `p.is_public and p.activated_at is not null`.
      **Kein `host_id`-Testfall** — er wäre nicht konstruierbar (Befund codex,
      MEDIUM): `visibility` kennt nur `public` und `members`, beide sieht jedes
      aktivierte Mitglied. Der Zweig bleibt trotzdem stehen, weil die Funktion
      die bestehende Policy spiegeln soll, in der er ebenfalls steht — dass er
      heute tot ist, gehört in den Kopf statt in eine Testbehauptung.
- [x] 2.4 `revoke execute … from public` und `grant execute … to authenticated`.
      **Nicht an `anon`** — ausgeloggt gibt es keine Teilnehmer, auch nicht bei
      einem öffentlichen Event.
- [x] 2.5 `comment on function` mit zwei Sätzen: warum die Policy unberührt
      bleibt, und warum nicht öffentliche Profile fehlen.
- [x] 2.6 **GREEN**: 2.1 läuft, inklusive des Regressionsfalls.
- [x] 2.7 `database.types.ts` um die RPC-Signatur ergänzen.

## 3 · Migration C — Bucket und Sichtbarkeit des Titelbilds

Datei: `supabase/migrations/20260812100200_event_covers_storage.sql`

Vorlage ist `20260812090100_post_media_storage.sql` (C7), nicht `covers` (C6) —
C6 hat einen **öffentlichen** Bucket und deshalb bewusst keine SELECT-Policy.
Hier trägt genau diese Policy die Zugriffskontrolle.

- [x] 3.1 **RED**: Fälle in `rls_test.sql`, alle rot: - ohne Session, Cover eines `public`-Events → lesbar - ohne Session, Cover eines `members`-Events → verweigert - aktiviertes Mitglied, `members`-Event → erlaubt - eingeloggt, **nicht** aktiviert → verweigert - Objekt ohne `events.cover_path`-Zeile → für niemanden lesbar - **verwaister fremder Pfad, an ein eigenes `public`-Event gehängt →
      für niemanden lesbar** (Befund codex, HIGH — die lesende Hälfte) - Hochladen in fremdes `{uid}/`-Präfix → verweigert - Hochladen ohne Aktivierung → verweigert
      Verweigerung jeweils **über den Fehler** belegen, nicht über die
      Zeilenzahl.
      **Nicht** aufgenommen: „Host auf das eigene, sonst unsichtbare Event" —
      nicht konstruierbar, siehe 2.3.
- [x] 3.2 Bucket `event-covers` anlegen: `public = false`, 2 MiB,
      `array['image/webp']`. **`on conflict (id) do update`**, nicht
      `do nothing` — ein bestehender Bucket mit falschen Einstellungen würde
      sonst konserviert und der Test liefe grün gegen eine falsche
      Konfiguration (Befund aus dem C6-Review).
- [x] 3.3 **Bucket-Konfiguration als eigene Assertion** (Befund codex, MEDIUM),
      nach dem Muster von `rls_test.sql:1515–1521`: `public = false`,
      `file_size_limit = 2097152`, `allowed_mime_types = {image/webp}`. Die
      tatsächliche Ablehnung eines zu großen oder nicht-WebP-Uploads kann pgTAP
      nicht messen — die Grenzen sitzen im Storage-Dienst, nicht in der
      Datenbank; sie gehört in die Sonde (9.4).
- [x] 3.4 Funktion `public.event_cover_lesbar(objektname text)`:
      `security definer`, `stable`, `set search_path = ''`; Nachschlag über
      `events.cover_path = objektname`; ohne Session nur `visibility = 'public'`
      (spiegelt `events_select_public_anon`), mit Session
      `is_activated() and (visibility in ('public','members') or host_id =
auth.uid())` (spiegelt `events_select_by_visibility`); **und in jedem
      Fall** `(storage.foldername(objektname))[1] = e.host_id::text`.
- [x] 3.5 `revoke execute on function … from public` und
      `grant execute … to anon, authenticated` (Befund codex, LOW). Nachgeprüft:
      `post_media_lesbar` tut genau das (`…post_media.sql:167–168`); ohne
      `revoke` wäre die Funktion für `PUBLIC` ausführbar.
- [x] 3.6 Vier Policies: `select` für `anon, authenticated` über die Funktion;
      `insert`/`update`/`delete` nur im eigenen `{uid}/`-Präfix hinter
      `public.is_activated()` — wörtlich wie bei den drei bestehenden Buckets.
- [x] 3.7 **Gate-Zählung für `event_cover_%`** nach dem Muster von
      `rls_test.sql:1524–1538` (`covers`), `:1536` (`avatars`) und `:2030–2038`
      (`post_media`): drei Schreib-Policies, alle mit `is_activated`. Jede
      Bucket-Sektion trägt ihre eigene Zählung — ohne diese zählt die
      Drift-Sicherung ab jetzt einen Bucket zu wenig, **ohne rot zu werden**.
- [x] 3.8 **GREEN**: 3.1 und 3.3 laufen.

## 4 · Migrationen anwenden

- [x] 4.1 Lokal: `supabase db reset`, alle drei laufen sauber durch, pgTAP grün.
- [ ] 4.2 **OFFEN — bewusst.** **Gegen DEV** (`foelowldexkcqzewvrcf`, Zielprojekt vorher nennen):
      `pnpm db:push`. Danach nochmals `supabase test db` gegen DEV, nicht nur
      lokal — ein grüner lokaler Lauf sagt nichts über DEV, wenn die
      Supabase-Versionen auseinanderliegen (Befund aus dem C7-Plan-Review).
      **Warum noch nicht gelaufen:** DEV ist das Projekt hinter
      `fbc-platform.pages.dev`. `starts_at set not null` bricht „Event anlegen"
      im Frontend, solange dort der Termin optional ist. Der Code ist jetzt
      gemerged, also gehören Migration und Deploy zusammen raus — die
      Reihenfolge ist `db push` → Frontend-Deploy, nicht umgekehrt.
- [ ] 4.3 **Merken für später:** `migrate-dev` wendet Migrationen auf DEV selbst
      an; danach überspringt `drift-gate` **jeden** Frontend-Deploy, bis
      `migrate-prod` gelaufen ist. Der Deploy danach geht nur per
      `gh run rerun --failed` und gibt bei Erfolg nichts aus. Kein Fehler,
      sondern der eingebaute Ablauf.

## 5 · Datenschicht

Datei: `src/lib/events.ts`, neu `src/lib/event-cover.ts`

- [x] 5.1 **RED**: Unit-Tests für `formatEventSpan`: gleicher Tag → ein Datum
      mit zwei Uhrzeiten; verschiedene Tage → beide Daten; ohne `ends_at` → nur
      der Beginn. **„Selber Tag" heißt: in der lokalen Zone des Browsers** —
      ein Fall über eine Sommerzeitgrenze gehört dazu, sonst ist die Regel eine
      Annahme (aus der Annahmenliste von codex). **Kein `vi.mock` auf eigene
      Komponenten**, keine Assertion auf alte Namen — beides ist grün und prüft
      nichts.
- [x] 5.2 `EventRow`, `EventListItem`, `EVENT_COLUMNS` um `description`,
      `ends_at`, `cover_path`, `topics` erweitern.
- [x] 5.3 `EventInput.startsAt` von `string | null` auf **`string`** verengen —
      die Spalte ist jetzt `not null`. Das **Lesemodell**
      (`EventListItem.startsAt`) bleibt tolerant; `partitionEvents`,
      `isPastEvent` und `formatEventDate` werden **nicht** angefasst. Absicht:
      ihre Null-Zweige sind ab jetzt unerreichbar, aber sie zu entfernen wäre
      ein Umbau, den diese Aufgabe nicht verlangt.
- [x] 5.4 `createEvent`/`updateEvent` um die vier Felder erweitern.
      **Entfernen-Semantik** (aus der Annahmenliste von codex): `cover_path`
      wird beim Speichern nur überschrieben, wenn ein neues Bild gewählt oder
      ausdrücklich entfernt wurde — nicht bei jedem Save auf null gesetzt.
- [x] 5.5 `fetchEventAttendees(eventId)`: RPC `event_attendees`, danach Namen
      über `profiles_public` auflösen. Weil die RPC nur öffentliche Profile
      liefert, ist die Auflösung vollständig; der Ersatztext bleibt für den
      Fall eines inzwischen gelöschten Profils.
- [x] 5.6 **Eigener Query-Key** `eventAttendeesKey(uid, eventId)` (Befund
      codex, HIGH). `attendeesKey` und `fetchAttendees` bleiben **unverändert**
      und behalten **beide** privilegierten Aufrufer: `HostTools` **und**
      `RatePanel` (`EventDetailPage.tsx:226`) — Fassung 1 behauptete „nur
      HostTools", und das war falsch. Zwei Schlüssel, zwei Datenformen; im
      Kommentar benennen, damit die nächste Person sie nicht zusammenlegt.
- [x] 5.7 **Invalidierung**: `eventAttendeesKey` nach Anmeldung **und**
      Abmeldung mit invalidieren (`RegistrationPanel.invalidate`). Ohne das
      zeigt die Reihe nach der eigenen Anmeldung veraltete Gesichter.
- [x] 5.8 `src/lib/event-cover.ts`: `EVENT_COVER_BUCKET`, **ein gebündelter**
      `createSignedUrls`-Aufruf für eine Pfadliste, Gültigkeit und
      Cache-Fenster **wörtlich** von `src/lib/post-media.ts` übernehmen
      (`SIGNATUR_GUELTIGKEIT_SEK`, `SIGNATUR_STALE_MS`). Nicht neu wählen — wer
      die Zahl ändert, ändert zugleich die Nachlaufzeit eines
      Sichtbarkeitswechsels. Query-Key **am Principal** gehängt: welche Cover
      signierbar sind, hängt am Aufrufer.
- [x] 5.9 Ein nicht signierbares Objekt fällt auf den Platzhalter zurück und
      reißt **nicht** die ganze Ansicht mit (Befund codex, MEDIUM). Unit-Test
      mit einer Teilantwort.
- [x] 5.10 `selectSimilarEvents(all, event, now)`: die drei nächsten kommenden
      desselben `type`, das eigene ausgenommen, aufgefüllt mit den nächsten
      kommenden überhaupt. Reine Funktion, Unit-Test **zuerst** — inklusive
      „weniger als drei desselben Typs".

## 6 · Formular

Datei: `src/components/events/EventForm.tsx`

Leitplanke: **keine Textwüste.** Nach diesem Block hat das Formular genau zwei
Pflichtfelder — Titel und Termin.

- [x] 6.1 **RED**: „leerer Termin blockiert das Absenden" und „Titel + Termin
      genügen". Der zweite ist der wichtigere: er hält fest, dass die vier
      neuen Felder optional sind.
- [x] 6.2 Beschreibung als mehrzeiliges Feld, optional.
- [x] 6.3 Ende als `datetime-local`, optional, neben dem Beginn. Client-seitig
      prüfen, dass es nach dem Beginn liegt — die Constraint fängt es sonst
      erst als rohen Datenbankfehler.
- [x] 6.4 Themen: eine Zeile je Programmpunkt, optional. **Keine Anbindung an
      `public.tags`** — das ist eine Tagesordnung, keine Schlagwortliste. Leere
      Zeilen werden verworfen; `topics` ist danach entweder `null` oder ein
      Array ohne Leerstrings.
- [x] 6.5 Titelbild: `AvatarCropper` mit `aspect = 3`, Ausgabe WebP, Upload
      nach `{uid}/{timestamp}.webp`. Der Cropper nimmt `aspect` bereits als
      Prop (`AvatarCropper.tsx:67`) und rendert dann eckig statt rund
      (`:215`) — er wird **nicht** angefasst.
- [x] 6.6 Ein **eigener Knopf zum Entfernen** des Titelbilds; Speichern ohne
      neue Auswahl behält das bestehende Bild (5.4). Test für beide Richtungen.
- [x] 6.7 Termin wird Pflichtfeld: `canSubmit` erweitern, Feld markieren.
- [x] 6.8 **Vorbelegtes Bearbeiten prüfen.** `EventForm` initialisiert seinen
      State mit `useState(initial?.…)`. Kommt `initial` erst **nach** dem Mount
      an, übernimmt `useState` den Wert nie — grüner Test, kaputte App
      (AGE-492). Auf der Detailseite liegt `event` beim Öffnen des Editors
      bereits vor; das ist zu **prüfen**, nicht anzunehmen.

## 7 · Übersicht

Dateien: `src/components/events/EventsList.tsx`, `EventCard.tsx`

- [x] 7.1 `CardGrid` auf `sm:grid-cols-2 lg:grid-cols-3`. Heute steht dort nur
      `sm:grid-cols-2` — der Schritt ist 2 → 3, nicht 4 → 3.
- [x] 7.2 Kachel nach Mockup: Titelbild mit Datumsmarke (Monat über Tag) links
      oben, Typ-Marke, Titel, Von–Bis, Ort, Teilnehmerzahl, Knopf.
- [x] 7.3 Ohne `cover_path` **und** bei nicht signierbarem Objekt ein neutraler
      Platzhalter in gleicher Höhe — sonst springt das Raster.
- [x] 7.4 **Ein** Signieraufruf für die ganze Liste (5.8), nicht einer je
      Kachel. Test, der die Zahl der Aufrufe festhält.
- [x] 7.5 Die Teilnehmer**zahl** kommt weiterhin aus
      `event_registration_counts`; `event_attendees` wird auf der Übersicht
      **nicht** aufgerufen. Das Mockup zeigt hier eine Zahl („63 nehmen teil"),
      keine Gesichter.
- [x] 7.6 `truncate` bei `location` beibehalten — eine `location` kann ein
      Zoom-Link sein und sprengt sonst die Spalte.
- [x] 7.7 Erste Testdatei zu `EventCard`.

## 8 · Detailseite

Datei: `src/pages/EventDetailPage.tsx`

- [x] 8.1 Titelbild als Header mit Datumsmarke; ohne Bild der Platzhalter.
- [x] 8.2 Titel, Typ-Marke, Von–Bis, Ort.
- [x] 8.3 Beschreibung; fehlt sie, entfällt der Block ganz statt leer zu stehen.
- [x] 8.4 Themen als Häkchenliste (Mockup-Lesart, siehe `proposal.md`).
- [x] 8.5 Veranstalter mit Bild, Name, Stufe und Verlinkung — der bestehende
      Block bleibt, er wird nur umplatziert. `host_partner_id` wird **nicht**
      ausgebaut. **Ohne Session entfällt der Block**: `hostsFor` fragt dann
      weder `profiles_public` noch `partners` (AGE-530), und das bleibt so.
- [x] 8.6 Teilnehmerreihe: bis zu fünf Avatare, dann `+n`, mit Gesamtzahl aus
      `event_registration_counts`. Quelle der Gesichter ist
      `fetchEventAttendees`. **Ohne Session wird sie nicht aufgerufen** (kein
      `execute` für `anon`) — der Block entfällt, statt einen `42501` in die
      Konsole zu schreiben.
- [x] 8.7 **Die Zahl wird nicht aus den Gesichtern gerechnet.** Weil die RPC
      Mitglieder außerhalb des Verzeichnisses auslässt, ist die Gesamtzahl
      größer als Gesichter + `+n`. Das ist gewollt (siehe `proposal.md`);
      ein Test hält es fest.
- [x] 8.8 Anmeldeknopf, Kapazität, Warteliste, Bewertung, `HostTools`:
      **unverändert**. Regressionstests für Bewertung (`RatePanel`) und
      `HostTools`, weil beide am alten Schlüssel hängen (5.6). Wenn sich beim
      Umbau herausstellt, dass eine Änderung sie doch berührt, vorher melden
      statt es zu lösen.
- [x] 8.9 Ähnliche Events aus `selectSimilarEvents`, gespeist aus **derselben
      Query** wie die Liste — mit `useQuery` auf `eventsListKey(uid)`, damit
      Deeplink, Neuladen und Lesezeichen sie ebenfalls zeigen (Befund codex,
      MEDIUM). Nicht auf einen gefüllten Cache hoffen.
- [x] 8.10 Erste Testdatei zu `EventDetailPage` — mindestens: Zeitspanne,
      Teilnehmerreihe mit `+n`, Gesamtzahl größer als die Gesichter, ähnliche
      Events ohne das eigene, ausgeloggt weder Host noch Teilnehmer.

## 9 · Belegen, nicht behaupten

- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün, Ausgabe
      gelesen. Vergleich gegen die Ausgangsmessung aus 0.6.
- [x] 9.2 `supabase test db --local supabase/tests/rls_test.sql
supabase/tests/grants_test.sql` grün, **mit** Pfadliste.
- [x] 9.3 **Sichtprobe im Browser, lokal, vor dem Commit.** Grüne Tests haben in
      AGE-492 ein visuell falsches Ergebnis durchgewunken, und in AGE-528 fand
      erst die Sichtprobe, dass `service_role` keine Tabellenrechte hält.
      Beide Seiten, **beide Themes**, Telefonbreite. Leere Seite plus stumme
      Konsole heißt Zombie-Vite auf 5173, nicht kaputte App.
- [x] 9.4 **Der Nachweis, den AGE-531 ausdrücklich verlangt**, als Sonde
      `scripts/probe-event-cover-signatur.ts` durch die echte Storage-API,
      Ausgabe nach `EVIDENCE.md`: - Cover eines `members`-Events, ohne Session → **keine Signatur**
      (Statuscode und Fehlermeldung, nicht „kein Bild zu sehen") - Cover eines `public`-Events, ohne Session → Signatur **und** Abruf 200 - Upload > 2 MiB → abgelehnt - Upload eines Nicht-WebP → abgelehnt - der gestohlene verwaiste Pfad → keine Signatur
      **Abbau (Befund gemini, LOW):** je Lauf ein eindeutiger Pfad, danach
      dieses eine Objekt gezielt löschen — nicht `emptyBucket`. Das ist
      verlässlicher als der C7-Weg, der in DEV einen Wegwerf-Bucket stehen
      ließ, während die Sonde „alles erfüllt" meldete.
- [x] 9.5 **Mechanik unversehrt**, am laufenden Stack durchgespielt, nicht nur
      im Test: anmelden · Warteliste bei voller Kapazität · abmelden ·
      Check-in als Host · bewerten nach dem Event · alle drei Reiter.
- [x] 9.6 Code-Review auf dem **Diff** (Schritt 4), unabhängig vom Verfasser.
      codex, `DIFF-REVIEWS.md`: vier Befunde, alle übernommen — darunter ein
      echter Fehler (der Host sah Abmeldungen als Teilnehmer).
- [x] 9.7 `openspec validate --all` grün.

## 10 · Abschluss

- [x] 10.1 Drei Commits: `f3ec42b`, `dce905f`, `f4c620b`.
- [x] 10.2 PR #166, gemerged als `5c90f6e`. Alle Checks auf der HEAD-SHA
      `f4c620b` grün (verify · migrations · edge-functions · pr-title · deploy);
      `edge-functions` war einmal rot durch `socket hang up` beim Deno-Download
      und lief nach `gh run rerun --failed` durch. Merge über
      `gh pr view --json state` geprüft: `MERGED`.
- [x] 10.3 `openspec archive` — 8 ADDED, 2 MODIFIED in `openspec/specs/events/`.
      `openspec archive`. **Szenario-Titel in den MODIFIED-Blöcken exakt
      wie im Bestand lassen** — ein umgetaufter Titel löscht das alte Szenario,
      und `validate` bleibt dabei grün; nur `archive` bricht ab.
- [ ] 10.4 Linear-Status **erst lesen** (`get_issue`), dann entscheiden, ob
      überhaupt geschrieben werden muss — die GitHub-Automation schaltet
      In Progress/Done selbst.
