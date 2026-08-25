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

- [x] 3.1 Test: beide Reiter stehen ohne einen einzigen Kontakt, Zähler 0.
- [x] 3.2 Test: ein angenommener Kontakt erscheint — in **beide** Richtungen
      der Anfrage, geprüft über `from_id` und `to_id`.
- [x] 3.3 Test: `pending`/`declined` erscheinen nicht.
- [x] 3.4 Test: der Zähler zählt die dargestellten Karten, nicht die
      angenommenen Anfragen. Aufbau: ein Kontakt, der im Verzeichnisergebnis
      fehlt.
- [x] 3.5 Test: die fünf Zustände sind unterscheidbar — lädt (kein Zähler),
      Kontaktabfrage gescheitert (Fehler, nicht „0"), keine Kontakte
      (Einladung), Kontakte ohne sichtbare Karte (eigener Hinweis), Filter
      schließt alle aus (Filterhinweis).
- [x] 3.6 Test: Suchbegriff überlebt den Reiterwechsel, beide Zähler zeigen die
      gefilterte Zahl.
- [x] 3.7 Test: Kontowechsel im selben `QueryClient` zeigt nicht die
      Kontaktmenge des vorigen Kontos.
- [x] 3.8 Umsetzung: `contactsQueryKey(uid)`, Abfrage auf `contact_requests`
      (`from_id`/`to_id`, `status = 'accepted'`), Reiter, Zähler aus der
      gefilterten Liste.

**Drei Befunde aus Abschnitt 3**

1. **Zustand 4 gegen Zustand 5 braucht eine zweite Menge.** „Kein Kontakt ist
   sichtbar" und „der Filter schliesst alle aus" lassen sich aus der
   GEFILTERTEN Liste nicht auseinanderhalten. Aufgelöst über die ungefilterte
   Baseline, die es für die Facetten ohnehin schon gibt — keine neue Abfrage.
2. **Der Schlüssel allein erfüllt die Anforderung nicht.** Er verhindert, dass
   Konto B die Menge von Konto A *sieht*; verworfen wird sie dadurch nicht. Die
   Anforderung verlangt beides, also zusätzlich `removeQueries` beim
   Identitätswechsel — mit einer eigenen Zusage, die rot wird, wenn man es
   herausnimmt.
3. **Drei bestehende Testdateien brachen**, weil `MemberDirectory` jetzt
   `useAuth` ruft und sie ohne `AuthProvider` rendern. Und eine ältere eigene
   Zusage war zu ungenau: sie prüfte „Bodo steht nicht auf der Seite", während
   Bodo als gewöhnliches Mitglied sehr wohl dort steht — sie prüft jetzt im
   Reiter.

## 4. Abnahme

- [x] 4.1 Sichtprobe im Browser mit einem echten angenommenen Kontakt —
      Reiter, Zähler, Cover, keine Chips. Zusätzlich die Admin-Mitgliederliste,
      weil sie dieselbe Karte benutzt.
- [x] 4.2 `pnpm test` grün, `tsc` sauber, `eslint` ohne Fehler,
      `supabase test db` mit Dateiliste grün.
- [x] 4.3 Mindestens eine Mutation je neuem Test.

**Zwölf Verbiegungen, alle rot — aber erst nach drei Korrekturen**

| Verbiegung | Zusage, die bricht |
|---|---|
| Marke wieder eingebaut | zeigt auf der Karte KEINE Kompass-Marken mehr |
| roher Pfad statt Auflöser | zeigt das Cover über den Bild-Auflöser |
| `aspect-[3/1]` entfernt | passt das Bild ein |
| `object-contain` → `-cover` | passt das Bild ein |
| Bildfeld nur mit Bild | behält das Bildfeld auch ohne Cover |
| Zähler aus der ID-Menge | zählt die dargestellten Karten |
| Fehler als leere Menge gelesen | gescheiterte Kontaktabfrage ist keine Null |
| Zustand 4 fällt mit 3 zusammen | Kontakte ohne sichtbare Karte, eigener Hinweis |
| `removeQueries` entfernt | verwirft die Kontaktmenge des vorigen Kontos |
| Kennung aus dem Schlüssel | trennt zwei Konten voneinander |
| Richtung ignoriert (immer `to_id`) | die Anfrage ging VOM Gegenüber aus |
| Zähler auch während des Ladens | ein Ladezustand zeigt keinen Zähler |

**Zwei der drei ersten „grün" waren Fehler der MESSUNG, nicht der Zusagen** —
und beide hätten als Freispruch durchgehen können: die eingebaute Marke sass
innerhalb von `member.branche && …`, und das Fixture trägt keine Branche, also
stand sie nie im DOM; das zweite `-t`-Muster traf den Umlaut in
„Bild-Auflöser" nicht und übersprang **alle 21** Zusagen. Eine Verbiegung, die
gar nicht ankommt, ist kein Beleg — die Zeile „21 skipped" ist der Unterschied.

**Der dritte war ein echter Befund.** Die Kennung aus dem Schlüssel zu nehmen
blieb grün, weil das `removeQueries` beim Identitätswechsel den Fehler
**verdeckt**: der Zwischenspeicher wird ohnehin geleert. Zwei Vorkehrungen, von
denen nur eine geprüft ist, sind eine geprüft — daher zwei zusätzliche Zusagen
direkt an `contactsQueryKey`, wo die Verdeckung wegfällt.
- [x] 4.4 `openspec validate --all` grün.

## Messung der Abnahme

**4.1 Sichtprobe im Browser** — gegen den LOKALEN Stack, weil die Migration nur
dort liegt; `pnpm dev` zeigte auf DEV und bekäme die alte Signatur. Eigener Port
(5175), damit der Vite-Server der Vorsitzung unangetastet bleibt.

Gemessen am Element, nicht am Bild, und nicht an der Fensterbreite:

| Karte | Cover | Kartenhöhe | Feld-Verhältnis | Bild geladen |
|---|---|---|---|---|
| Bea Kontakt | 400×400 (1:1) | 395 px | 3,000 | ja |
| Carl Fremd | **keines** | 395 px | 3,000 | — |
| Dana Fremd | 600×100 (6:1) | 395 px | 3,000 | ja |
| Donald Sichtprobe | 600×100 (6:1) | 395 px | 3,000 | ja |

**Alle vier exakt gleich hoch, auch die ohne Bild** — das Raster franst nicht
aus. `object-fit: contain` am Bild, beide Extremverhältnisse vollständig
sichtbar. `naturalWidth > 0` ist dabei der Punkt, den jsdom nie liefern kann:
der Pfad→URL-Weg trägt wirklich, die Bilder sind da statt nur verlinkt.

Keine einzige „Bietet"/„Sucht"-Marke, obwohl das Fixture Carl Fremd Kategorien
in `offers` und `needs` gibt. Reiter: „Alle Mitglieder 4" · „Meine Kontakte 1",
die Zahl je `aria-hidden` neben der Beschriftung. Unter „Meine Kontakte" steht
genau das eine Gegenüber, dessen Anfrage **eingehend** angenommen wurde.

Suchbegriff „Carl" über den Reiterwechsel: Feld behält den Wert, die Zähler
gehen auf **1 / 0**, und es erscheint „Dazu passt keiner deiner Kontakte" —
nicht die Einladung. Konsole ohne Fehler und Warnungen.

**Admin-Ansicht** (Rolle geliehen und zurückgenommen, `staff_roles` danach
wieder leer): dieselbe Karte, Cover geladen, Verhältnis 3,000, keine Marken.
Die Kartenhöhen unterscheiden sich dort zwischen den Rasterzeilen (392/392/392
und 369/369) — innerhalb einer Zeile fluchten sie. Das ist die
Grid-Zeilenhöhe und die bestehende `flex-1`-Anordnung der Admin-Fläche, nicht
diese Änderung.

**4.2** `pnpm test` 1690 grün · `tsc` sauber · `eslint src` 0 Fehler (4
Warnungen, alle in nicht angefassten Dateien) · `supabase test db` mit
Dateiliste: 10 Dateien, **719** Zusagen grün.

**Zwei Fallen auf dem Weg zur Sichtprobe**, beide von der Sorte „prüft einen
Namen statt einer Sache": der Opt-in-Wächter des Demo-Seeds sieht den Zielhost
**gar nicht** an, und `resolveSsl` erkennt lokal am Wort `localhost` — unter
`127.0.0.1`, das `supabase status` ausgibt, nimmt es den TLS-Weg und scheitert.
