# Plan-Review — glocke-und-hinweistypen (AGE-620)

Zwei Reviewer, beide **anderer Anbieter** als der Autor des Deltas (Claude).
Beide **REQUEST-CHANGES**. Der Plan wurde daraufhin an zwei Stellen umgeworfen
und an einer verkleinert — alles, bevor eine Zeile Migration existierte.

| Reviewer | Modell (selbstgemeldet) | Verdikt |
| --- | --- | --- |
| `gemini` | gemini-pro | REQUEST-CHANGES |
| `opencode` | Kimi-K3 (Moonshot AI) | REQUEST-CHANGES |

`codex` wurde nicht befragt: es prüft nicht selbst, sondern startet
Unter-Reviewer und liefert deren Antwort unter seinem Namen.

## Der Befund, der den Kern umgeworfen hat

`opencode`, allein: **die Stufenschwelle für Beiträge existiert nicht mehr.**

Der Plan stützte sich auf `posts_select_by_visibility` aus
`20260806080100_activation_gate.sql:157` — `visibility='members'` verlange
`has_level(4)`. Nachgemessen: `20260826100000_members_sind_alle_aktivierten.sql:49-59`
(AGE-601) hat die Policy am **26.08.** ersetzt. Sie lautet seither
`is_activated() and (public or members or eigener Beitrag)` — **ohne Schwelle**.

Der Plan war am **27.08.** geschrieben. Gemessen wurde also an einer Fassung,
die einen Tag zuvor ersetzt worden war. Das ganze Leck-Narrativ des ersten
Entwurfs („ein `connect`-Mitglied erfährt Name und Tatsache") ist für Beiträge
hinfällig.

**Übernommen, vollständig.** Die Empfängermenge ist jetzt als das beschrieben,
was sie ist: jedes aktivierte Mitglied außer dem Auslöser.

Dieselbe Prüfung brachte zwei Folgefehler:

- **`prime` und `legacy` sind seit `20260715150000` per Check-Constraint
  verboten** (`check (visibility in ('public','members'))`), für `posts` wie für
  `events`. Die pgTAP-Aufgaben „`visibility='prime'` → null Zeilen" waren damit
  **nicht konstruierbar** — der Insert verletzt den Constraint, bevor ein
  Trigger feuert. Gestrichen.
- **`events.visibility` defaultet auf `'public'`**, nicht auf `'members'`. Im
  Plan nicht behauptet, aber der Vollständigkeit halber nachgetragen.

## Der Befund, der eine Doppelankündigung verhindert hat

`opencode`, allein: `trg_event_feed_post`
(`20260813100000_posts_kind_event_trigger.sql:220`) spiegelt **jedes Event mit
Host** synchron als `posts`-Zeile mit `kind='event'`, gleicher `visibility` und
dem Host als Autor. Ein Fan-out über `posts` hätte jedes Event **zweimal**
angekündigt, an denselben Empfängerkreis. Der Plan kannte `posts.kind` nicht.

**Übernommen:** der Posts-Trigger feuert nur für `kind = 'member'`; der
Events-Trigger bleibt eigenständig, damit ein Event **ohne** Host — für das kein
Spiegel entsteht — überhaupt angekündigt wird.

## Der Befund, der die Testart geändert hat

`opencode`: der Plan schrieb das Sichtbarkeits-Prädikat ein zweites Mal hin —
*„exakt das Muster, vor dem AGE-601 selbst warnt, und exakt das Muster, das
diesem Plan gerade innerhalb von 24 h zum Verhängnis wurde."*

**Übernommen, und es ist die wertvollste Änderung des ganzen Reviews.** Der Test
prüft jetzt **Parität**: je geschriebener Zeile wird der Empfänger per
`request.jwt.claim` impersoniert und behauptet, dass er den Gegenstand *sieht*.
Eine Abschrift hat ein Verfallsdatum; eine Paritätszusage fängt das nächste
AGE-601. Das Delta trägt dafür ein eigenes Szenario, das absichtlich rot werden
kann („Die Paritätsprüfung kann fehlschlagen").

## Was die Entscheidung des Auftraggebers aufgelöst hat

`gemini` nannte als **Showstopper**, der Import erzeuge 70 × 70 ≈ 4900 Zeilen in
einer Transaktion, und forderte, den Trigger während des Imports abzuschalten.

**Die Prämisse ist falsch**, nachgemessen an `openspec/specs/member-import/spec.md:50`:
der Import setzt *„Mitgliedsstufe `impact` und **keine Freischaltung**
(`activated_at` nicht gesetzt)"*. Es gibt keine Massenaktivierung; jedes Mitglied
aktiviert sich selbst über seinen Link. `gemini` hat den vorgelegten Text
geprüft, nicht die Welt.

**Ein Rest blieb und war echt:** über die Startwoche aktivieren sich ~70
Mitglieder nacheinander, das zuletzt aktivierte bekäme **69** Hinweise „neues
Mitglied" auf einmal. Keine Lastfrage, eine Bedienfrage.

Donald hat daraufhin am 27.08. entschieden, **den Typ „neues Mitglied" ganz
wegzulassen** — vier Typen statt fünf. Damit entfällt der Trigger auf `profiles`,
und mit ihm lösen sich vier von opencodes Pflicht-Änderungen auf, statt
beantwortet zu werden: das Trigger-Ereignis (INSERT vs. `update of
activated_at`), die Reaktivierung, die Import-Antwort und der Schutzschalter.

## Weiter übernommen

1. **Die Opt-out-Funktion bekommt KEIN Ausführrecht zurück** (`opencode`). Der
   Plan wollte dem `is_contactable`-Muster folgen — das braucht aber
   `grant … to authenticated`, weil es aus **Policy-Ausdrücken** als die
   anfragende Rolle läuft. Die Opt-out-Funktion wird ausschließlich aus der
   Trigger-Funktion gerufen. Ein Rück-Grant machte sie zu einem Orakel auf fünf
   Boolesche je fremdem Mitglied — klein, aber grundlos.
2. **Fan-out als EIN `insert … select`**, nicht als Schleife in plpgsql
   (`opencode`, mit Zahlen: ~15 kB WAL, einstellige Millisekunden).
3. **Die Nutzlast ist mitgliederkontrollierter Text** (`opencode`) —
   `contact_request` trägt seit Juni ein frei formuliertes `message`. Die Glocke
   rendert als Text, nie als Markup. Steht jetzt in der Anforderung.
4. **Baumelnde Referenzen** (beide): ein Hinweis auf einen gelöschten Gegenstand
   muss als Satz lesbar bleiben. Eigenes Szenario, und im Test abgedeckt.
5. **Wortlaute richtiggestellt** (`opencode`): `is_activated()` heißt seit
   `20260823120000` aktiviert **und nicht deaktiviert und nicht gelöscht`; und
   `member_settings` trägt mehr als drei Spalten — gemeint war „keinen einzigen
   In-App-Schalter".
6. **`events.visibility` defaultet auf `public`** — nachgetragen.

## Nicht übernommen, mit Begründung

- **Namen maskieren, wenn `is_public = false`** (`opencode`, Befund 5). Der
  Einwand ist richtig: unter `discover` sieht ein Mitglied fremde Vollzeilen
  nicht, erfährt über `from_name` aber einen Namen. Donald hat am 27.08.
  entschieden, das **bewusst zu akzeptieren**: wer auf einem fremden Beitrag
  handelt, tut einen öffentlichen Akt gegenüber genau dieser Person. Das
  bestehende `contact_request` hält es seit Juni ebenso. `opencode` selbst nennt
  diese Auflösung vertretbar und verlangt nur, dass sie **benannt** wird — sie
  steht jetzt im Proposal.
- **Dedup beim Like-Umschalten** (`opencode`, Befund 8). Ein Like, zurückgenommen
  und neu gesetzt, erzeugt zwei Hinweise. Die kleinste Lösung wäre ein Löschen
  beim Unlike — eine Verhaltensänderung an einer fremden Tabelle für einen
  Randfall. Im Proposal als bewusst offen benannt.
- **Spaltengrant auf `read_at`** (`opencode` rät selbst ab): bricht den
  Golden-Snapshot, null Grenzgewinn.

## Was beide bestätigt haben

- `SECURITY DEFINER` für den Opt-out-Zugriff ist richtig und das etablierte
  Muster (`member_settings_own` ist streng eigene Zeile).
- Die Grants-Argumentation stimmt: `grants_test.sql:51` führt `member_settings`
  tabellenweit, die Spalten-Assertion deckt es nicht ab. Neue Spalten brechen
  keine der beiden Zusagen.
- `notifications_own` als `for all` ist kein Grenzproblem: Selbst-Fälschung und
  Selbst-Löschung haben keine Fremdwirkung.
- Die Nutzlast ohne Beitragstext ist der richtige Kompromiss und folgt dem
  bestehenden Muster.
- Der tote Knopf, die drei Bestandstypen und die null Lesezugriffe im Frontend —
  von `opencode` einzeln nachgemessen.

## Eine Anmerkung, die stimmt

`opencode`: zum Zeitpunkt der Review lagen bereits `src/lib/hinweise.ts` und
zwei Testdateien im Worktree — die Umsetzung des **Frontend-Teils** hatte
begonnen, bevor die Review durch war. Bewusst: der Change-Gate verlangt nur ein
grünes `validate`, und die Glocke berührt weder Migration noch Rechte, für die
die Hausregel eine Review vorschreibt. Die Migration wurde **nicht** vor dieser
Review geschrieben.
