---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: 080122a0c0758f11ddee62fb8be31e37f08241169153f417a7a75683eab22cf8
---

# Change review — anon-skips-author-enrichment

Zwei Vendoren, keiner davon der eigene. Der SHA oben deckt die **erste**
Fassung der Artefakte — die Fassung, die jetzt im Verzeichnis liegt, ist das
Ergebnis dieses Reviews.

> **Ohne Gate-Trailer, absichtlich.** Der Gate meldet dazu
> `trailer-absent` und zählt diese Datei mit null Reviewern — nicht blockierend,
> und derselbe Hinweis steht bei allen zehn anderen Changes im Repo. Der Trailer
> wird vom Produzenten `run-plan-review.sh` geschrieben und bindet den Review per
> Digest an `proposal.md`, `design.md` und die Deltas. Diese Artefakte wurden
> **nach** dem Review überarbeitet, genau weil er Befunde hatte; ein von Hand
> gesetzter Trailer behauptete also eine Bindung, die es nie gab. Den Review
> stattdessen auf der neuen Fassung zu wiederholen, schließt der Skill aus — sein
> Wert liegt darin, vor dem Code zu laufen, und der steht.

## Reviewer: gemini (gemini-3-pro)

VERDICT: APPROVE

[LOW] specs/events — Kein Szenario für ein Event, das **beide** Host-Arten
trägt. Die Absicht sei erkennbar, stehe aber nicht da.

Angenommene Annahmen laut gemini: `uid` sei eine verlässliche Quelle für den
Anmeldezustand; die Oberfläche komme mit einem fehlenden Host ohne Darstellungs-
fehler zurecht; die Prüfung, dass `fetchAttendees` nur eingeloggt montiert ist,
stimme.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

[HIGH] specs/events, proposal — `partners` sei **nicht** anonym lesbar; die
geplante anonyme Partner-Abfrage laufe selbst in eine Abweisung, der
Partner-Host erschiene ohnehin nicht, und „Konsole fehlerfrei" wäre unerfüllbar.

[HIGH] proposal, specs/community-feed — Der Vorschlag mache aus einer
Client-Einsparung eine Sicherheitszusage. Bei einem späteren `anon`-Grant träten
Namen über REST ohnehin aus; umgekehrt maskiere die Oberfläche längst über
`displayAuthor()`, die behauptete Folge („dann erschienen sofort Namen") treffe
also nicht zu.

[MEDIUM] proposal, tasks, specs/community-feed — Der anonyme Kommentarpfad
existiere nicht: `comments` sei `authenticated`-only, ein anonymer Abruf
scheitere vor `fetchAuthors`. Ein Test darauf prüfte einen unmöglichen Zustand.

[MEDIUM] beide Spec-Deltas — „authenticated" garantiere keine Namen:
`profiles_public` liefert nur aktivierte, öffentlich gestellte Profile.

[MEDIUM] tasks, proposal — Die Live-Abnahme lasse öffentliche Routen aus; `/`
rufe `fetchFeed` **und** `fetchEvents`, `/events/:id` habe einen eigenen Pfad.

[LOW] specs/community-feed, tasks — „Mitglied" (Datenrückfall) und „Ein
Mitglied" (sichtbares Etikett) würden vermengt.

[LOW] proposal — Die Sentry-Behauptung sei unbelegt; beide Lesepfade schluckten
ihren Fehler ohne `captureException`.

## Not counted

- **codex, erster Lauf** — exit 4, Zeitüberschreitung bei 300 s. Nicht gezählt;
  mit `REVIEWER_TIMEOUT=540` wiederholt, der zweite Lauf endete mit exit 0 und
  ist die oben protokollierte Stimme.

## Resolution

Jeder Befund wurde **am Repository nachgeprüft**, nicht geglaubt. Fünf hielten
stand, zwei waren teilweise zu stark.

- **[HIGH] `partners` anonym lesbar — bestätigt, übernommen.**
  `20260715140000_explicit_grants.sql:62` erteilt `select` ausschließlich an
  `authenticated`, und `openspec/specs/partners/spec.md` führt „Anonymous
  partner read is denied" als Anforderung. Meine Behauptung war schlicht
  falsch, und sie hätte den zweiten 401 stehen lassen. `hostsFor` überspringt
  ausgeloggt jetzt **beide** Hälften; das Spec-Delta und die Aufgaben sind
  entsprechend neu geschrieben. Ausgeloggt erscheint ein Event ohne
  Host-Angabe — die einzige sichtbare Verhaltensänderung, jetzt ausdrücklich
  im Vorschlag benannt.
- **[HIGH] Sicherheitszusage — bestätigt, übernommen.**
  `src/lib/displayAuthor.ts:21` maskiert bedingungslos ohne Session und wird an
  drei Stellen benutzt (`CommunityFeed.tsx:614` und `:1055`,
  `HomePage.tsx:180`), mit grünem Test. Damit ist Punkt 3 der
  Issue-Begründung — „die Anonymisierung hängt ausschließlich am fehlenden
  Recht" — widerlegt. Vorschlag und Spec-Delta sagen jetzt ausdrücklich, dass
  dies **keine** Sicherheitsgrenze ist. Der von codex vorgeschlagene
  Regressionstest auf das *Fehlen* des Grants wird **nicht** ergänzt: er gehört
  zur Datenbank (pgTAP), nicht in einen Change, der die Datenbank nicht
  anfasst, und AGE-528 hat die anon-Sichtbarkeit gerade erst gegen das echte
  Schema belegt.
- **[MEDIUM] anonymer Kommentarpfad — bestätigt, übernommen.**
  `explicit_grants.sql:67` erteilt `select, insert on comments` nur an
  `authenticated`. `fetchComments` fliegt aus dem Change; die zugehörigen
  Aufgaben und Szenarien sind entfernt. Zusatzbefund beim Nachprüfen: selbst
  ohne Grant-Frage käme dort nie eine Abfrage zustande, weil `fetchAuthors`
  bei leerer ID-Liste vorher zurückkehrt.
- **[MEDIUM] „authenticated" garantiert keine Namen — bestätigt, übernommen.**
  Beide Szenarien sind auf „authentifiziert **und aktiviert**, Profil über
  `profiles_public` sichtbar" verengt, mit einer ausdrücklichen Zeile, dass der
  bisherige Rückfall sonst bestehen bleibt.
- **[MEDIUM] Live-Abnahme unvollständig — bestätigt, übernommen.**
  `HomePage.tsx:49,53` ruft beides. Aufgabe 3.3 nennt jetzt alle vier Flächen
  (`/`, `/aktivitaet`, `/events`, `/events/:id`) und verlangt **null**
  verbotene Anfragen statt „fehlerfrei".
- **[LOW] „Mitglied" vs. „Ein Mitglied" — bestätigt, übernommen.** Der
  Datenrückfall in `authorOf()` heißt „Mitglied", das sichtbare Etikett aus
  `displayAuthor` heißt „Ein Mitglied". Beide Fassungen trennen das jetzt und
  weisen es der jeweiligen Schicht zu.
- **[LOW] Sentry — bestätigt, übernommen.** `fetchAuthors` und `hostsFor`
  schlucken ihren Fehler; `captureException` steht in `feed.ts` nur an Medien
  (`:384`) und Zählern (`:396`), in `events.ts` nur an den Zählern (`:260`).
  Die Behauptung stammte aus dem Issue-Text und ist gestrichen — es bleibt bei
  Konsole und Breadcrumb.
- **[LOW, gemini] Event mit beiden Host-Arten — gegenstandslos geworden.**
  Nachdem ausgeloggt beide Hälften entfallen, gibt es den Mischfall dort nicht
  mehr. Für den eingeloggten Fall ist der Vorrang des Partner-Hosts als Zeile
  im Szenario ergänzt.

**Nicht übernommen:** codex' Vorschlag, den fehlenden `anon`-Grant per
Regressionstest festzuschreiben (Begründung oben) — und seine Annahme, alle
Anreicherungen auf öffentlichen Routen liefen nur über `fetchAuthors` und
`hostsFor`. Letzteres wurde geprüft: `fetchAttendees` ist die dritte Stelle,
liegt aber hinter `uid: string` und ist ausgeloggt nicht erreichbar. Das steht
im Vorschlag unter *Impact*.
