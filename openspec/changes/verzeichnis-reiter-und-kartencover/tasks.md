# Tasks — Verzeichnis (AGE-595)

## 1. Migration — ZWEI Funktionen, nicht eine

- [x] 1.1 `search_directory` mit `cover_url` im Rückgabesatz: `drop function`
      der Acht-Argument-Signatur, dann `create`, dann `revoke`/`grant` neu.
      Grund für Drop statt Replace ist hier der **Rückgabetyp** (`42P13`), ein
      anderer als bei AGE-494 (Argumentliste). Beides in den Migrationskopf.
- [x] 1.2 `admin_list_members` **ebenso** um `cover_url` erweitern, per
      Drop/Create, Grants neu. Ohne das bricht die Spalten-Parität, die die
      Admin-Spec ausdrücklich fordert, und mit ihr `AdminMitgliederPage`, das
      dieselbe `MemberCard` speist.
- [x] 1.3 `directory_search_test.sql` — Zusagen für `cover_url`: gesetzt, `null`,
      Ausführungsrechte an der neuen Signatur.
- [x] 1.4 `admin_member_list_test.sql` — Paritätstest nachziehen. Er MUSS vor
      1.2 rot werden; wird er das nicht, prüft er die Parität nicht.
- [x] 1.5 Lokal gegen `supabase start` anwenden, `supabase test db` mit
      Dateiliste laufen lassen (ohne Liste lügt der Befehl), Spalte im Ergebnis
      sehen — nicht am SQL-Text prüfen.
- [x] 1.6 `database.types.ts` neu erzeugen; `AdminMember` und `DirectoryMember`
      tragen danach beide `cover_url`.
      **Gemessen anders ausgeführt:** die Datei ist ausdrücklich VON HAND
      gepflegt — ihr eigener Kopf hält seit AGE-498 fest, dass ein volles
      `supabase gen types` sie stillos umschreibt (Semikolons weg) und
      RPC-Rückgabespalten als non-null markiert, was rund zwanzig Fixtures
      bricht, die legitim `null` prüfen. Gemessen: 817 Diff-Zeilen nach
      Formatierung, davon eine einzige sachlich meine. `cover_url` daher von
      Hand an beide Rückgabetypen, an derselben Stelle wie in der Datenbank.

**Messung zu Abschnitt 1 — die beiden RED-Läufe**

| Schritt | Ergebnis |
|---|---|
| Zusagen ohne Migration | `column "cover_url" does not exist` — beide Dateien rot |
| Migration NUR `search_directory` | `directory_search_test` grün, `admin_member_list_test` rot an **„… und keine Verzeichnisspalte fehlt"** — der Paritätstest prüft wirklich die Parität |
| beide Funktionen | 101 Zusagen grün (Verzeichnis, Admin, Grants) |

Die Vakuum-Wache musste nachgezogen werden: das Vergleichsmitglied trug kein
Cover, also verglichen beide Funktionen `null` mit `null`. Es trägt jetzt einen
Pfad.

## 2. Karte (RED vor GREEN)

- [x] 2.1 Test: eine Karte mit Kategorien zeigt keine „Bietet:"/„Sucht:"-Marke.
- [x] 2.2 Test: `has_offers` ohne Kategorie erzeugt keine nackte „Bietet"-Marke.
- [x] 2.3 Test: die Branche bleibt.
- [x] 2.4 Test: Karte mit `cover_url` zeigt das Bild — **Fixture trägt einen
      Pfad**, kein `https://…`, und die Zusage prüft die aufgelöste Adresse
      (`bildUrl("covers", …)`). Ein URL-Fixture wäre grün bei toten Bildern.
- [x] 2.5 Test: Karte ohne Cover behält dieselbe Höhe; Bildfeld ist 3:1 und
      passt ein.
- [x] 2.6 Umsetzung in `MemberDirectory.tsx`.
- [x] 2.7 Gegenprobe, dass `AdminMitgliederPage` die geänderte Karte weiter
      speist (sie übergibt `AdminMember`, nicht `DirectoryMember`).
      **Zwei Befunde, beide aus der Gegenprobe selbst:**
      1. `AdminMitgliederPage.test.tsx` mockt `supabase` OHNE `storage`. Die
         Datei war nur deshalb grün, weil ihr Fixture `cover_url: null` trug und
         `bildUrl` in der ersten Zeile aussteigt — der Storage-Weg wurde nie
         betreten. Die Zusage setzt jetzt ausdrücklich ein Cover.
      2. Die Karte steht dort nur unter der Ansicht **„Verzeichnis"**, nicht
         unter der Startansicht „Tabelle". Eine Zusage ohne diesen Klick hätte
         eine Ansicht geprüft, in der die Karte gar nicht vorkommt.

**Was jsdom hier NICHT belegt.** Die Zusagen zu 3:1 und gleicher Höhe sind
strukturell — Klassenvertrag und Vorhandensein des Feldes —, weil jsdom kein
Layout rechnet. Die Höhe selbst ist Sache der Sichtprobe (4.1).

## 3. Reiter (RED vor GREEN)

- [ ] 3.1 Test: beide Reiter stehen ohne einen einzigen Kontakt, Zähler 0.
- [ ] 3.2 Test: ein angenommener Kontakt erscheint — in **beide** Richtungen
      der Anfrage, geprüft über `from_id` und `to_id`.
- [ ] 3.3 Test: `pending`/`declined` erscheinen nicht.
- [ ] 3.4 Test: der Zähler zählt die dargestellten Karten, nicht die
      angenommenen Anfragen. Aufbau: ein Kontakt, der im Verzeichnisergebnis
      fehlt.
- [ ] 3.5 Test: die fünf Zustände sind unterscheidbar — lädt (kein Zähler),
      Kontaktabfrage gescheitert (Fehler, nicht „0"), keine Kontakte
      (Einladung), Kontakte ohne sichtbare Karte (eigener Hinweis), Filter
      schließt alle aus (Filterhinweis).
- [ ] 3.6 Test: Suchbegriff überlebt den Reiterwechsel, beide Zähler zeigen die
      gefilterte Zahl.
- [ ] 3.7 Test: Kontowechsel im selben `QueryClient` zeigt nicht die
      Kontaktmenge des vorigen Kontos.
- [ ] 3.8 Umsetzung: `contactsQueryKey(uid)`, Abfrage auf `contact_requests`
      (`from_id`/`to_id`, `status = 'accepted'`), Reiter, Zähler aus der
      gefilterten Liste.

## 4. Abnahme

- [ ] 4.1 Sichtprobe im Browser mit einem echten angenommenen Kontakt —
      Reiter, Zähler, Cover, keine Chips. Zusätzlich die Admin-Mitgliederliste,
      weil sie dieselbe Karte benutzt.
- [ ] 4.2 `pnpm test` grün, `tsc` sauber, `eslint` ohne Fehler,
      `supabase test db` mit Dateiliste grün.
- [ ] 4.3 Mindestens eine Mutation je neuem Test.
- [ ] 4.4 `openspec validate --all` grün.
