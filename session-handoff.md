# Session Handoff — 2026-08-29 (Nacht, zwei neue Features geplant)

**Sitzung:** `fbc-platform-f4`. **Worktree gewechselt:** die Arbeit läuft jetzt
in `fbc-platform.donald-age-667-geplante-beitraege`, Branch
`donald/age-667-geplante-beitraege`, frisch von `origin/main` (0 Commits
dahinter, geprüft). Der alte Worktree `fbc-platform.neuigkeiten-archiv` trägt
nichts Ungesichertes mehr.

> ## ⚠ Der Stand in einem Satz
>
> **AGE-667 ist bis zum Gate geplant, aber es ist keine Zeile Code gebaut.**
> Der OpenSpec-Change `geplante-beitraege` liegt vollständig auf dem Branch
> (proposal, design, Spec-Delta, tasks, REVIEWS), `openspec validate --all` ist
> grün, die Plan-Review ist gelaufen und eingearbeitet. Nächster Schritt ist
> **A1**.

## Was Donald wollte

Zwei Dinge in einem Zuruf, die **nicht** zusammengehören:

1. **Wiederkehrende Events** (jeden 1., jeden ersten Dienstag, alle 2 Monate am
   ersten Dienstag) — und im Feed erscheint nur der **nächste** Termin der
   Reihe. → **AGE-630**, noch nicht angefangen.
2. **Aktivität planen** — Beitrag jetzt schreiben, am nächsten Freitag live
   schalten. → **AGE-667**, geplant, siehe unten.

Donald hat **A zuerst** gewählt.

## Vier Entscheidungen zu den Terminreihen (AGE-630) — schon getroffen

Sie stehen noch in **keinem** Change; ohne sie fängt die nächste Sitzung falsch
an:

| Frage | Donalds Antwort |
| --- | --- |
| Anmeldung pro Termin oder für die Reihe? | **Beides, pro Reihe entscheidbar** — die teuerste der drei Optionen |
| Wo gilt „nur der nächste"? | **Überall**, aber Ersteller und Admin sehen die ganze Reihe |
| Einzeltermin verschieben/absagen? | **Ja, beides** |
| Wer darf Serien anlegen? | *nicht gefragt* — offen |

**Daraus folgt zwingend: materialisieren, nicht berechnen.** Sobald ein
einzelner Termin verschiebbar ist und Anmeldungen daran hängen, braucht jede
Ausgabe eine eigene Identität. Weiter: das Coverbild wandert an die **Serie**
(`events_cover_path_key` ist UNIQUE — zwanzig Termine können sich heute kein
Bild teilen), Absagen **löscht nicht** (sonst verlieren Anmeldungen den Bezug),
und die Zeitzone gehört ins Modell („jeden Dienstag 19 Uhr" über die
Zeitumstellung ist in `timestamptz` nicht geschenkt).

Vorgeschlagener Zuschnitt: **B** = Serie + Regel + Materialisierung + „nur der
nächste" + Anmeldung pro Termin; **C** = Ausnahmen + Reihen-Anmeldung. Das ganze
Entwurfsrisiko liegt in B.

## AGE-667 — was geplant ist

**Sichtbarkeit wird gerechnet, nicht geschaltet:** `veroeffentlicht_ab <=
now()` im Prädikat, kein Lauf, der freischalten könnte. **Die Ankündigung
dagegen braucht einen Lauf** — Donald hat entschieden, dass ein geplanter
Beitrag beim Live-Gehen ankündigen soll. Der Unterschied trägt den ganzen
Entwurf: fällt der Lauf aus, erscheint der Beitrag trotzdem und ist nur
unangekündigt; er verbirgt **keinen** Inhalt.

Gemessen aus dem lebenden Katalog (`pg_policies` + `pg_proc`), nicht aus den
Migrationsdateien: **sieben** Tore entscheiden über die Sichtbarkeit eines
Beitrags — zwei Policies, vier lesende DEFINER-Funktionen und **ein
schreibender Trigger**. `post_media_lesbar` ist der gefährlichste lesende:
ohne sie wäre der Beitrag unsichtbar und sein **Bild** signierbar.

## Was die Plan-Review gefunden hat

**Zwei HOCH von opencode, beide berechtigt, beide nachgemessen.**

1. **Mein Entwurf zählte nur die lesenden Tore.**
   `trg_hinweis_neuer_beitrag` feuert `after insert on public.posts` und kündigt
   **jedem aktivierten Mitglied** an — Glocke **und** Push, mit `autor_name` im
   Payload. Ein geplanter Beitrag hätte im Moment des *Planens* alle Telefone
   erreicht, für etwas, das niemand sehen darf. Ich schrieb „keine
   Benachrichtigung beim Freischalten"; das Problem war die Benachrichtigung
   **beim Planen**.
2. **Der `drop function` bricht sechs Testaufrufer**, die meine Flächen-Tabelle
   nicht nannte — darunter eine `has_function_privilege`-Zusage in
   `rls_test.sql`, die die alte Signatur wörtlich nennt. CI wäre rot geworden.

**gemini hat zum dritten Mal an diesem Abend erfunden**: sein „wichtigster und
gefährlichster Befund" (`get_posts_for_feed`) existiert nicht, und die drei
zitierten Migrationsdateien tragen **2024er** Namen in einem Repo mit
ausschliesslich 2026ern. Alles gegen den Katalog widerlegt und in `REVIEWS.md`
festgehalten — samt der einen Stelle, auf die es mit falschem Beleg richtig
gezeigt hat (`post_saves`).

**Und eine Korrektur an mir selbst:** meine Prüffrage 2 unterstellte, `post_likes`
sei ungeschützt. Ist es nicht — `WITH CHECK` prüft die Existenz des Beitrags.
Eine Frage mit falscher Prämisse hat beide Reviewer Zeit gekostet und einen von
beiden auf eine erfundene Antwort gezogen.

## Files modified

Alles neu, alles unter
`openspec/changes/geplante-beitraege/`: `.openspec.yaml`, `proposal.md`,
`design.md` (acht Entscheidungen), `specs/community-feed/spec.md` (2 ADDED +
2 MODIFIED), `tasks.md` (A–F plus B′), `REVIEWS.md`.

**Kein Code, keine Migration, keine Testdatei.**

## Next session: start here

**Erste Aktion: `openspec/changes/geplante-beitraege/tasks.md` lesen und mit A1
anfangen** — die Migration mit der Spalte. Die Reihenfolge A → B → B′ → C → D →
E ist nicht beliebig: ohne Spalte kein Tor, ohne Tore keine Oberfläche, die man
gefahrlos zeigen kann.

**Eine Entscheidung steht vor B′5** und ist die einzige, die eine Instanz
anfasst: ob der Ankündigungs-Lauf als Migration entstehen kann. `pg_cron` fehlt
im lokalen Stack und in der frischen CI-Abbildung — eine Migration mit
`cron.schedule` bräche den Job `migrations`. Zwei Wege: von Hand auf beiden
Seiten (wie der Wiederholungslauf aus AGE-641, Vorlage in `docs/secrets.md`),
oder in der Migration hinter `if exists (select 1 from pg_extension where
extname='pg_cron')`. Der zweite ist für dieses Repo **neu** und deshalb zu
messen, nicht anzunehmen.

**Der Branch ist gepusht**, damit die Artefakte ein Aufräumen des Worktrees
überleben — das ist am 28.08. schon einmal schiefgegangen. Kein PR: es ist
nichts zu mergen, solange nichts gebaut ist.

## Open questions

- **AGE-666 hält `CI/verify` auf `main` rot** — flackernder Test in
  `PublicProfilePage.test.tsx`, Ursache belegt, Fix ist eine Zeile
  (`getByRole` → `await findByRole`). Die Abnahme braucht die **ganze** Suite
  mehrfach; isoliert war die Datei 12 von 12 grün und hätte jede Korrektur
  bestätigt. b7 hat denselben Flacker-Typ ein zweites Mal gesehen
  (`use-gespraech.test.tsx` auf #286) — die Ursache dort ist **nicht** geprüft.
- **AGE-630 braucht noch einen eigenen Change**; die vier Entscheidungen oben
  gehören hinein, bevor jemand anfängt.
- **Wer darf Terminreihen anlegen?** Nicht gefragt. Events darf heute jedes
  Mitglied einstellen; eine Reihe mit zwanzig Terminen ist eine andere
  Grössenordnung.
- **AGE-665** (Spec-Drift im Titelbild-Abschnitt) und **AGE-664** (die letzte
  beschneidende Fläche) und **AGE-660** — alle drei klein, alle drei offen.
- **AGE-599 abnehmen** braucht zwei Schritte: erst die acht Objekte in
  `event-covers` auf DEV löschen, dann seeden. `x-upsert: false` ersetzt sie
  sonst nicht.
- **Der lokale Stack ist verstellt** (von b7): `hinweis_neue_nachricht()` trägt
  die neue Fassung, `schema_migrations` steht noch auf `20260828180000`. Ein
  `db reset` bringt es gerade — und wird für AGE-667 ohnehin gebraucht.
- Unverändert offen: AGE-610 · AGE-512 · Aktivierungsversand 69/72 · Rotation
  des PROD-DB-Passworts · AGE-598 · AGE-256 · AGE-606 · AGE-628/629.
