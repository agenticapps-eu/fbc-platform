# Tasks — Glocke und vier Hinweistypen (AGE-620)

## 0. Vor dem ersten Code messen — und die Messung datieren

- [x] Glocke ist ein toter Knopf (`AppShell.tsx:566`), Frontend liest
      `notifications` an **null** Stellen.
- [x] `notifications` trägt `read_at`, Grants für `authenticated`, Policy
      `notifications_own`. Drei Typen schreiben bereits.
- [x] **Korrektur zum Handoff:** Das Opt-out braucht DOCH eine Migration —
      `member_settings` trägt keinen einzigen In-App-Schalter.
- [x] Aber **keine neuen Grants**: `grants_test.sql:51` tabellenweit, die
      Spalten-Assertion (`:113-127`) deckt `member_settings` nicht ab.
- [x] **FEHLGESCHLAGEN und korrigiert:** Die erste Messung las
      `activation_gate.sql:157` als aktuelle Posts-Policy. Sie ist seit
      `20260826100000` (AGE-601, 26.08.) ersetzt — **keine Stufenschwelle mehr**.
      Wer eine Policy misst, muss die JÜNGSTE Migration suchen, nicht die
      erstbeste.
- [x] `prime`/`legacy` sind per Check-Constraint verboten
      (`20260715150000:262-265` und `:284-287`) — Szenarien darüber sind nicht
      konstruierbar.
- [x] `trg_event_feed_post` (`20260813100000:220`) spiegelt jedes Event mit Host
      als `posts`-Zeile mit `kind='event'`.

## 1. Anforderung aus AGE-299 herauslösen

- [x] Glocken-Anforderung aus `add-lifecycle-notifications` entfernt.
- [x] Dort `proposal.md` und `tasks.md` nachgezogen, damit kein Text eine Spec
      behauptet, die es nicht mehr gibt.
- [x] `openspec validate --all` grün (30 Items).

## 2. Plan-Review, zwei Fremdanbieter

- [x] `gemini` und `opencode`, beide REQUEST-CHANGES → `REVIEWS.md`.
- [x] Kernbefund umgeworfen (AGE-601), Doppelankündigung aufgelöst,
      Testart von Abschrift auf **Parität** geändert.
- [x] Donald entscheidet: Typ „neues Mitglied" entfällt, Name bleibt in der
      Nutzlast. Damit fällt der `profiles`-Trigger ganz weg.

## 3. Migration

- [x] Vier Spalten auf `member_settings`, `not null default true`.
- [x] **Eine** `SECURITY DEFINER`-Funktion für das Opt-out, Signatur so eng wie
      möglich, `stable`, `set search_path = ''`, fehlende Zeile ⇒ `true`.
- [x] Ihre Entzüge nennen **alle vier Rollen** und geben **nichts** zurück —
      sie wird nur aus den Trigger-Funktionen gerufen (AGE-622-Regel).
- [x] Fan-out als **ein** `insert … select`, nicht als Schleife.
- [x] Empfängermenge: `is_activated()`-Semantik, nicht abgeschrieben — die
      Bedingung kommt aus derselben Funktion, die die Policies rufen.
- [x] Auslöser bekommt nie einen Hinweis über die eigene Handlung.
- [x] **Posts-Trigger nur für `kind = 'member'`** — sonst kündigt jedes Event
      doppelt an.
- [x] **Events-Trigger bleibt eigenständig** — sonst bekäme ein Event ohne Host
      gar keine Ankündigung.
- [x] Nutzlast: Kennungen plus kurzer Anzeigetext. Kein Beitragstext.

## 4. pgTAP — Parität statt Abschrift

- [x] **Paritätszusage:** je geschriebener Zeile den Empfänger per
      `request.jwt.claim` impersonieren (Muster 13× in `rls_test.sql`) und
      behaupten, dass er den Gegenstand **sieht**.
- [x] Eine Zusage, die absichtlich rot werden kann: Empfängermenge künstlich
      erweitern ⇒ Parität schlägt fehl und **nennt** den Empfänger.
- [x] Nicht aktiviertes / deaktiviertes / gelöschtes Mitglied: nie Empfänger.
- [x] Opt-out aus ⇒ **keine Zeile geschrieben**, nicht bloß verborgen.
- [x] Keine `member_settings`-Zeile ⇒ wird benachrichtigt.
- [x] Kommentar/Like auf **eigenen** Beitrag ⇒ null Zeilen.
- [x] Event mit Host ⇒ **genau eine** Ankündigung je Empfänger, nicht zwei.
- [x] Event ohne Host ⇒ trotzdem angekündigt.
- [x] Opt-out-Funktion ist für **keine** Client-Rolle ausführbar.
- [x] **Positivkontrolle in jeder Negativzusage** — „null Zeilen" belegt nichts
      ohne einen Nachbarfall, der Zeilen erzeugt.
- [x] Neue Testdatei in die Dateiliste in `ci.yml` eintragen. Zwei vollwertige
      Suiten liefen dort schon einmal monatelang gar nicht.

## 5. Glocke im Frontend

- [x] `src/lib/hinweise.ts` — lesen (nur ungelesen, mit Grenze), einzeln und
      alle markieren, nur `read_at`, Serverzeit statt Client-Uhr. 6 Tests.
- [x] `HinweisGlocke.tsx` — Zahl nur bei > 0, Zahl im zugänglichen Namen,
      Auf/Zu wie das Profilmenü (`mousedown` + Escape, `absolute` statt
      `fixed`), ein Satz je Typ, Rückfall bei unbekanntem Typ und leerer
      Nutzlast. 12 Tests.
- [x] **Am Typecheck gefangen, nicht am Test:** `Icon name="check"` existiert
      nicht (48 Namen geprüft) — jsdom rendert dafür ein leeres `<svg>`, ohne
      zu meckern. Durch einen Textknopf ersetzt.
- [x] In `AppShell` verdrahten, Live-Aktualisierung wie `useUngelesenLive`.
- [x] **320 px am Inhaltsbedarf gemessen**, nicht am Fenster. Ergebnis: der
      rechte Cluster braucht **150 px** (Sprechblase 36 + Glocke 36 + Profilmenü
      62 + zwei Lücken à 8), und die Glocke ist **mit** Zähler genauso 36 px
      breit wie ohne — die Blase liegt `absolute`, also außerhalb des Flusses.
      Der Change fügt der Kopfzeile damit **null Pixel** hinzu; die 12 px
      Reserve vom 26.08. bleiben unangetastet.

## 6. Einstellungen

- [x] Vier Schalter, je Typ einer.
- [x] Nicht über `saveProfile` speichern — das schreibt alle Profilspalten und
      löscht Interessen und Ziele.

## 7. Abnahme am Artefakt

**Der Befund, den nur der Browser liefern konnte.** Der Zähler blieb bei 1
stehen, während in der Tabelle 2 standen. Ursache war nicht das Abo, sondern
dass `notifications` gar nicht in der Publikation `supabase_realtime` steht —
Postgres sendet dafür schlicht keine Ereignisse. Kein jsdom-Test hätte das
gefunden (dort gibt es keinen Server) und kein pgTAP-Test (die Zeile in der
Tabelle war ja richtig). Behoben in Abschnitt 7 der Migration.

- [x] Lokal mit zwei Konten im Browser: Bernd schreibt einen Beitrag, Annas
      Zähler geht **ohne Neuladen** von 1 auf 2, das Panel zeigt zwei lesbare
      Sätze, „Gelesen" nimmt einen weg (2 → 1), „Alle als gelesen" leert (→ 0),
      danach steht **keine Zahl** am Knopf und `aria-label` fällt auf
      „Benachrichtigungen" zurück.
- [x] Nebenbei belegt: einer der beiden Sätze war
      „Bernd Testfall hat Ihre Kontaktanfrage angenommen" — ein Hinweis aus dem
      **Bestand**, den seit Juni niemand sehen konnte.
- [x] Opt-out und die Event-Einmaligkeit sind in **pgTAP** belegt, nicht im
      Browser: beides ist eine Aussage über geschriebene Zeilen, und die sieht
      man in der Oberfläche gerade nicht. Genau deshalb steht es dort.
- [x] `pnpm test`, `tsc`, `eslint`, `prettier --check` auf eigenen Dateien.
      Nie `pnpm format`.

## 8. Was dieser Change NICHT tut

- Kein Mailversand (AGE-299 behält ihn).
- Kein Typ „neues Mitglied" — Entscheidung vom 27.08., siehe Proposal.
- Kein Dedup beim Like-Umschalten, bewusst benannt.
- Keine Maskierung des Handelnden-Namens, bewusst entschieden.
