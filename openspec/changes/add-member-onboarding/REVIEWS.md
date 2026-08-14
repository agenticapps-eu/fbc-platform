---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2-default, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: c0d9e52bf1e64a59cf6beb8feb951999546030279b07fc14805ef91c91279c8a
---

# Change review — add-member-onboarding

Schritt 2b, ausgeführt am 2026-08-14, **vor** der ersten Codezeile. Eigener
Anbieter (`claude`) ausgeschlossen. Beide Reviewer liefen über
`~/.agenticapps/bin/reviewer-cli.sh` mit `REVIEWER_TIMEOUT=540` und endeten mit
Exit 0.

**Zur Modellangabe:** `gpt-5.6-sol` steht so im Lauf von codex. Für gemini gibt
der Lauf **kein** Modell her — der Wrapper ruft `gemini -p` ohne Modellwahl, und
weder `~/.gemini/settings.json` noch die Umgebung setzen eines. Notiert ist
deshalb die CLI-Version (0.28.2) mit ihrem Standardmodell; das ist weniger, als
die Regel verlangt, und geraten wäre schlechter.

**Bereinigt:** gemini hängt seinem Ergebnis acht Zeilen `SessionEnd`-Hook-Protokoll
an. Sie sind entfernt und waren nicht Teil der Antwort.

---

## Reviewer: gemini (CLI 0.28.2, Standardmodell)

**VERDICT: REQUEST-CHANGES**

- **[HIGH]** `App.tsx` / `WillkommenPage.tsx` — Die Strecke außerhalb der
  `AppShell` schließt Navigation und Logout aus. Wer dort landet, ist gefangen;
  die einzigen Auswege sind ein dauerhaftes Überspringen oder das Ändern der
  Adresszeile. — *Fix:* innerhalb der `AppShell` rendern.
- **[MEDIUM]** Spec-Delta / „keine Formularwand" — „eine überspringbare Wand ist
  keine" deutet eine ausdrückliche Anforderung um. Für den, der ein Dashboard
  erwartet, ist ein seitenfüllender Pflichtprozess faktisch eine Wand. — *Fix:*
  die Diskrepanz anerkennen und vom Product Owner abnehmen lassen, statt sie
  wegzuargumentieren.
- **[LOW]** Migration — `onboarded_at is null` bei jedem Aufruf der Startseite
  führt ohne Index zu einem Full Table Scan. — *Fix:* partieller Index.

**Nicht ausgesprochene Annahmen (gemini):** dass die Unterbrechung toleriert
wird · dass Nutzer verstehen, dass Überspringen dauerhaft und geräteübergreifend
gilt · dass niemand Abschluss und Überspringen unterscheiden will.

## Reviewer: codex (gpt-5.6-sol)

**VERDICT: REQUEST-CHANGES**

- **[HIGH]** Delta / „Ein Abbruch verliert nichts" — Mit nur einem Merker gibt es
  keinen Teilfortschritt. Ob ein Schritt abgeschlossen, bewusst leer
  weitergeklickt oder nie gesehen wurde, ist aus den Daten nicht ableitbar; die
  Wiederaufnahme „an der Stelle" ist so nicht implementierbar.
- **[HIGH]** `tasks.md` 5.3/7 · `profile.ts::saveProfile` — kein feldbezogener
  Schreibweg: schreibt alle Profilspalten, legt die Kontaktzeile an, ersetzt
  Interessen und Ziele, stößt Score- und Match-Berechnung an.
- **[HIGH]** `tasks.md` 2.4/9.1 — Ein fremdes `UPDATE` ergibt **nicht** `42501`.
  Die Policy filtert die Zeile über `USING` heraus; PostgreSQL führt das
  Statement mit null geänderten Zeilen erfolgreich aus.
- **[HIGH]** `design.md` §3 — „Die Strecke wählt nur an" ist mit vorbelegten
  Chips unvereinbar: was gesetzt angezeigt wird, ist anklickbar und damit
  abwählbar, und Abwählen löscht alle Zeilen der Kategorie.
- **[MEDIUM]** Der Merker in `profiles` wäre für Mitglieder ab `discover`
  sichtbar. — *Fix:* `member_settings` oder eine eigentümerbeschränkte Tabelle.
- **[MEDIUM]** `design.md` §1 — Es fehlt der Entwurf, woher `HomeRedirect` den
  Merker bekommt: Lade-, Fehler- und Cachezustand sind offen.
- **[MEDIUM]** `tasks.md` 7.3 — `region` ist heute Freitext; eine kanonische
  Standortliste existiert nicht.
- **[MEDIUM]** „Fließtext neben den Chips" ist unterbestimmt: mehrere Zeilen je
  Kategorie, Zeilen ohne Kategorie, und `fetchCategorySelection` lädt gar keine
  Beschreibungen.
- **[MEDIUM]** Delta / Auslöser — genannt ist der Sitzungsaufbau, gebaut ist ein
  Besuch von `/`. Der Delta fordert selbst, dass Deep-Links nichts auslösen.
- **[MEDIUM]** `design.md` §2 — `onboarded_at` beantwortet die Auswertungsfrage
  nicht: Abbrecher bleiben `NULL`, Abschluss und Überspringen sind gleich.
- **[LOW]** `NARROW_ROUTES` ist für eine Route außerhalb der `AppShell` wirkungslos.

**Nicht ausgesprochene Annahmen (codex), sinngemäß:** dass auch Staff-, Admin-
und Demo-Konten die Strecke bekommen · dass Weitergehen mit leerem Feld erlaubt
ist · dass bestehende Kategorien vorausgewählt sind · dass AGE-534 zuordenbare
Beschreibungen liefert · dass es eine verbindliche Standortliste gibt · dass der
Client den Zeitwert selbst bestimmen darf · dass „Dashboard" und `/` dasselbe
bleiben · dass „elf Kategorien" elf verschiedene meint.

---

## Nachgeprüft, bevor übernommen

Fünf Tatsachenbehauptungen wurden an der Platte geprüft. **Vier bestätigt, eine
widerlegt.**

| Behauptung | Ergebnis |
|---|---|
| `saveProfile` schreibt nicht feldbezogen | **bestätigt** — `profile.ts:303-360`: alle Profilspalten, `profile_contacts`-Upsert bedingungslos, `profile_interests` und `profile_goals` gelöscht und ersetzt |
| `profiles` ist ab `discover` fremdlesbar | **bestätigt** — `profiles_select_self_or_discover`: `id = auth.uid() or public.has_level(3)` (`20260715150000:177`) |
| `region` ist Freitext | **bestätigt** — `ProfileFieldsets.tsx:46`: `<Input {...register("region")}>`; keine Standortliste im Repo |
| `NARROW_ROUTES` wirkt nur in der Shell | **bestätigt** — gelesen in `AppShell.tsx:268`; `/login` und `/onboarding` stehen dort heute schon wirkungslos drin |
| Index nötig gegen Full Table Scan | **widerlegt** — der Zugriff ist `where profile_id = auth.uid()`, ein Primärschlüsseltreffer. Ein Index auf `onboarded_at` käme nie zum Einsatz |

## Resolution

**Übernommen — codex HIGH 1 (Teilfortschritt).** Die Anforderung wird schmaler
und ehrlich: die Strecke beginnt beim **ersten Schritt, dessen Feld leer ist**.
Kein erfundener Fortschrittszustand. Wer leer weitergeht, sieht den Schritt
wieder — tragbar, weil es jetzt einen ausdrücklichen Weg gibt, die Strecke zu
beenden. Design §7, Delta „Ein Abbruch verliert nichts".

**Übernommen — codex HIGH 2 (`saveProfile`).** Die Strecke schreibt feldbezogen
auf die eigene Zeile und benutzt aus `profile.ts` nur den Bild-Upload. Die
Zusicherung prüft nicht das geschriebene Feld, sondern dass **Interessen und
Kontaktzeile unverändert** sind (Aufgabe 5.2, muss gegen einen
`saveProfile`-Aufruf rot werden). Design §4.

**Übernommen — codex HIGH 3 (`42501`).** Aufgaben 2.4 und 9.1 erwarten jetzt
`OK` mit null geänderten Zeilen **plus** eine Nachlese des unveränderten
Fremdwerts; `42501` nur für `anon`.

**Übernommen — codex HIGH 4 (Abwählen).** Schritt 2 ist **baulich** additiv: ein
Chip für eine bereits gesetzte Kategorie ist nicht bedienbar. Damit kann
`ConfirmationRequiredError` nicht entstehen — nicht weil man es unterlässt,
sondern weil die Oberfläche es nicht anbietet. Design §5, eigene Anforderung im
Delta, Aufgabe 6.2.

**Übernommen — codex MEDIUM (Sichtbarkeit).** Der Merker wandert nach
`member_settings`. Das ist der wertvollste Befund des Reviews: die Tabelle ist
„strictly own-profile only", trägt **Tabellen**-Grants und hat mit
`20260804120000_member_settings_theme.sql` einen Präzedenzfall, dessen Kopf
festhält „KEINE neue Policy und KEIN neuer Grant". Damit entfallen auf einen
Schlag der Spalten-Grant, der Golden-Snapshot-Bruch in `grants_test.sql` samt
CI-Job und die Preisgabe an fremde Mitglieder. Der Change wurde durch den Review
**kleiner**.

**Übernommen — codex MEDIUM (Zustandsautomat).** Eigene Anforderung: lädt /
Fehler / fertig, mit drei Szenarien und den Aufgaben 3.6–3.8. Ein Lesefehler gilt
ausdrücklich **nicht** als „Merker nicht gesetzt".

**Übernommen — codex MEDIUM (`region`).** Freitext bleibt Freitext. Die
`Controller`-Aufgabe war ein Muster ohne Anlass und ist gestrichen.

**Übernommen — codex MEDIUM (Fließtext).** Aufgabe 6.6 legt fest: eigener
Lesepfad, je Seite, Zeilen ohne Kategorie eingeschlossen, mehrere Zeilen als
Liste, und ein Fall für „kein Freitext → kein Platzhalter".

**Übernommen — codex MEDIUM (Auslöser).** Die Anforderung heißt jetzt „Aufruf der
Startseite". Der vorige Wortlaut widersprach sich selbst.

**Übernommen — codex MEDIUM (Auswertung).** Die Behauptung, `onboarded_at`
beantworte „wer hat die Strecke gesehen", ist aus Design §3 entfernt und durch
die Feststellung ersetzt, dass sie das **nicht** tut.

**Übernommen — codex LOW (`NARROW_ROUTES`).** Aufgabe gestrichen, im Proposal als
„nicht betroffen" begründet. Die bestehenden toten Einträge sind als Nachlauf
notiert, nicht als Diff.

**Übernommen — codex „elf Kategorien".** Gezählt: sechs Optionen je Seite, elf
verschiedene Werte, `immobilien` auf beiden. Der Delta sichert deshalb **keine**
feste Gesamtzahl zu.

**Teilweise übernommen — gemini HIGH und MEDIUM (die Wand).** Beide zielen auf
dieselbe Frage, und sie ist eine Produktfrage. **Donald hat sie am 2026-08-14
entschieden:** die Strecke bleibt außerhalb der `AppShell`, bekommt aber eine
kurze Nutzenerklärung vorweg und **zwei** Auswege — „Später" (vertagt, ohne
Merker) und „Überspringen" (endgültig, mit positiv formuliertem Hinweis darauf,
dass der Kompass-Filter einen ohne Kategorien nicht findet).

Damit ist geminis HIGH in seinem Kern beantwortet — es gibt jetzt einen Ausweg,
der nichts kostet —, ohne die Fokussierung aufzugeben, die `/login` und
`/onboarding` heute ebenfalls haben. Geminis MEDIUM ist **vollständig**
übernommen: die Umdeutung „eine überspringbare Wand ist keine" ist aus dem
Proposal entfernt und durch eine ausdrückliche Abnahme ersetzt.

**Nicht übernommen — gemini LOW (Index).** Widerlegt. Der Merker wird über
`profile_id = auth.uid()` gelesen, den Primärschlüssel von `member_settings`. Ein
Index auf `onboarded_at` würde nie benutzt; der beschriebene Full Table Scan kann
nicht auftreten.

**Offen gelassen, benannt statt beantwortet:** codex' Annahme, dass auch Staff-,
Admin- und Demo-Konten die Strecke bekommen, trifft zu und bleibt so — sie ist
überspringbar, und eine Ausnahmeregel für Rollen wäre mehr Code als Nutzen. Wenn
das am Go-Live stört, ist es ein Einzeiler in der Weiche.
