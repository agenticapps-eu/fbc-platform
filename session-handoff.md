# Session Handoff — 2026-09-28 (AGE-927 Mitglied anlegen)

> **Scope dieser Übergabe: AGE-927.** Fremde offene Punkte stehen hier bewusst
> NICHT. Die Fassung zu AGE-903 steht in `git log -- session-handoff.md` auf
> `main` und gehört der abgeschlossenen Arbeit.

> ## ⚠ ZUERST
>
> **Kein Code geschrieben — das Gate steht noch offen und soll es bleiben.**
> Der Change ist vorgeschlagen, das Delta geschrieben, eine Review-Runde
> aufgelöst. `openspec validate --all` 36/0.
>
> **Zwei Dinge fehlen vor der ersten Codezeile:**
>
> 1. **opencode lief in Runde 2 in den 180-s-Timeout** und ist nicht gezählt.
>    Die Zwei-Anbieter-Regel ist für die **korrigierte** Fassung damit nicht
>    erfüllt. Wiederholen mit hochgesetztem Timeout:
>    `REVIEW_TIMEOUT=600 ~/.agenticapps/bin/run-plan-review.sh mitglied-anlegen --implementing-host claude gemini opencode`
>    — opencode war in Runde 1 der schärfere der beiden.
> 2. **gemini (Runde 2) hält die Teilausfall-Oberfläche für zu vage:** was sieht
>    der Admin während 35 aufeinanderfolgenden Aufrufen, aktualisiert sich die
>    Tabelle mit, was beim Wegnavigieren. Die Zusage steht, die Darstellung
>    nicht. Gehört in `design.md`.
>
> Der Erzeuger schreibt `REVIEWS.md` neu. **Die Resolution vorher sichern** —
> sie steht dort vor dem Trailer und wäre sonst weg.

## Accomplished

**Die Frage beantwortet, mit der die Sitzung begann:** nein, ein Weg, ein
Mitglied von Hand anzulegen, existiert nicht. AGE-927 stand auf Todo, ohne
Change, ohne Branch.

**AGE-927 in Linear ergänzt** um den Prozessteil, die auf PROD gemessenen Zahlen
und die Begründung, warum der Filter eine Migration braucht:

| | |
|---|---|
| Profile gesamt | 78 |
| bestätigt | 28 |
| **nicht bestätigt** | **50** |
| … davon Link schon verschickt | 15 |
| … davon **nie eingeladen** | **35** |

**Change `mitglied-anlegen`** mit Proposal, Design, Delta (vier Anforderungen
geändert mit allen 31 Szenarien, zwei neu), Tasks und `REVIEWS.md`.

**ADR-0007** zur Grenzverschiebung — siehe unten.

## Decisions

**Der Einladungsstand wird ABGELEITET, nicht gespeichert.** Keine Spalte in
`profiles`, kein Flag, kein Trigger. *Warum:* die Wahrheit steht in
`activation_tokens`; eine zweite Ablage liefe auseinander, sobald irgendein Weg
ein Token erzeugt, ohne die Kopie zu berühren.

**Die Mehrfachauswahl öffnet den AGE-304-Zaun eng** (Donald, 28.09.). Die
geltende Spec schloss sie **wörtlich** aus. Sie darf jetzt ausschliesslich den
bestehenden Aktivierungslink auslösen; Massenmail, CRM und Newsletter bleiben
wortgleich verboten. Festgehalten in **ADR-0007**, mit den verworfenen
Alternativen und der ausdrücklichen Folge, dass der Zaun dünner wird.

**Kein „alle auf dieser Seite auswählen".** *Warum:* ein Kopfkästchen über
Schritt ① wäre mit **einem** Klick deckungsgleich mit „alle 35 einladen" — genau
der Alternative, die ADR-0007 verwirft. Befund des Plan-Reviews, und er trifft.

**Die Schleife lebt im Frontend** über die bestehende Einzel-Function. *Warum:*
so **gilt** jeder Schutzriegel unverändert, statt in einem zweiten Endpunkt
nachgebaut zu werden.

## Drei Annahmen, die am Katalog fielen

Zwei davon meine eigenen. Alle drei gemessen, nicht diskutiert:

* **`admin_member_counts` liefert `TABLE(status, anzahl)`** — Zeilen je Zustand,
  keine Spalte je Zustand. Ihr Rückgabetyp ändert sich nicht, `create or
  replace` genügt.
* **Der Abwurf scheitert NICHT an `pg_depend`.** `member_state_matches` ist
  `sql`, beide Aufrufer sind `plpgsql`, und für alle drei stehen **null**
  Referenten. Er bricht die Aufrufer nur **still** bis zur Neuanlage in
  derselben Transaktion — das zu wissen ist wichtiger als ein Fehlschlag.
* **Auf `auth.users(email)` gibt es keinen Unique-Constraint**, sondern den
  partiellen Unique-**Index** `users_email_partial_key` —
  `btree (email) where (is_sso_user = false)`, also **schreibungsempfindlich**.
  Der einzige Index über `lower(email)` ist nicht unique. `A@x.de` neben
  `a@x.de` fängt die Datenbank nicht.

Dazu eine eigene Falschbehauptung korrigiert: ein `::regprocedure`-Cast auf eine
verschwundene Signatur prüft nicht stillschweigend nichts — er wirft `42883`.

## Der Schutzriegel, der jede Oberfläche hier betrifft

`issue_activation_token` verschickt **nichts**, wenn ein gültiger, unbenutzter
Link jünger als 24 h im Postfach liegt (`pending`). Dazu 60 s je Profil und 5 pro
Tag — **je Profil**, nicht je Absender (gemessen). Ein Bericht, der dann
„verschickt" meldet, wäre gelogen; die getrennte Rückmeldung steht deshalb als
Zusage im Delta, nicht als Detail im Entwurf.

## Files modified

* `openspec/changes/mitglied-anlegen/{proposal,design,tasks}.md`,
  `specs/admin/spec.md`, `REVIEWS.md` — neu.
* `docs/decisions/0007-mehrfachauswahl-nur-fuer-den-aktivierungslink.md` — neu.
* Kein Produktionscode. Keine Migration. Nichts an der Datenbank.

## Next session: start here

`cd /Users/donald/worktrees/fbc-platform/mitglied-anlegen`. Branch
`mitglied-anlegen`, **bewusst ohne Kürzel** — AGE-927 gehört nur in den Titel
des letzten PR, sonst schliesst ein Teil-PR das Issue zu früh. Zwei Commits,
**noch nicht gepusht**, Arbeitsbaum sauber.

Die beiden Punkte aus dem ZUERST-Block abarbeiten, dann §2 der `tasks.md`: die
Migration, RED zuerst.

## Zustand der Umgebung

* **AGE-903 ist fertig und auf PROD ausgeliefert** (vorige Sitzung). `main` steht
  auf `150c0a2`, alles grün.
* Im **Haupt-Checkout** `/Users/donald/Sourcecode/factiv/fbc-platform` liegt
  **fremde ungesicherte Arbeit** (AGE-907): `session-handoff.md` geändert plus
  untracked Archivdateien. **Nicht anfassen.** Sie bringt den `sync-main`-Hook
  von `wt switch` zum Scheitern; der Weg daran vorbei ist
  `wt switch --create <name> --base origin/main --no-hooks --no-cd`.
* Der Worktree `stufen-v5` steht noch (AGE-903, gemergt) und kann mit
  `wt remove` weg — Donald hat das nicht freigegeben, deshalb blieb er.

## Open questions

* **Teilausfall-Oberfläche** — die einzige inhaltlich offene Frage (gemini,
  Runde 2).
* **Was gilt, wenn das Konto entsteht und das Setzen von Name oder `tier` danach
  scheitert?** Ein Konto ohne Stufe ist ein Zustand, den die Liste zeigen können
  muss. Steht als Aufgabe, ist aber nicht entschieden.
* **Schreibt GoTrue beim Admin-Anlegen selbst klein?** Zu messen, nicht
  anzunehmen — davon hängt ab, ob die Normalisierung allein trägt.
