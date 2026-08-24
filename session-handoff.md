# Session Handoff — 2026-08-24 (achtzehnte Sitzung)

**AGE-582 ist geplant, nicht gebaut.** Der OpenSpec-Change
`activity-concept-level` steht mit allen vier Artefakten plus `REVIEWS.md`,
`openspec validate --all` ist 32/32 grün, PR #205 ist offen. Kein Code, keine
Migration, keine Zeile Frontend.

**Die Plan-Review hat zwei Fehler gefunden, die ich sonst gebaut hätte.** Beide
stehen unten unter Decisions, weil sie den Entwurf gedreht haben.

## Accomplished

**Altlast geschlossen.** PR #204 (Handoff-Commit) hatte alle vier Pflichtchecks
grün → gemergt (`01bbeee`). Der Linear-Kommentar zu AGE-582, den die
siebzehnte Sitzung nicht schreiben konnte (Klassifikator), ist geschrieben —
mit den Entscheidungen, den fünf Korrekturen am Issue-Text und den offenen
Punkten.

**Der Change steht.** `openspec/changes/activity-concept-level/`: Proposal,
Design, zwei Spec-Deltas (19 Anforderungen), 77 Aufgaben in sieben Abschnitten,
`REVIEWS.md`. Umfragen (§5) sind **bewusst draußen** — Change B.

**Fünf Stellen, an denen AGE-582 aus dem Konzeptbild statt aus dem Code
zitiert**, sind im Delta korrigiert: neun statt sieben Streu-Glyphen (SVGs
liegen in **14** Dateien außerhalb `src/vision`) · `CrownIcon` steht
**byte-gleich zweimal** (`building-blocks.tsx`, `ProfileHero.tsx`) ·
`matching/CategoryIcon.tsx` ist ein zweiter Satz · Icon-Satz und Bereichs-Kanon
sind zwei Dinge · die vier Dashboard-Karten aus dem Issue gibt es bei uns nicht
(wir haben „Neu in der Aktivität", „Neue Mitglieder für dich", „Deine nächsten
Schritte").

**Plan-Review mit zwei fremden Vendoren** (gemini, codex; Delta von Claude),
beide REQUEST-CHANGES, **fünf HIGH bestätigt, einer widerlegt**. Jeder Befund
am Code nachgeprüft, bevor er angenommen wurde.

**Ein Befund war beim Nachrechnen schärfer als gemeldet:** `authenticated` hält
UPDATE auf `post_likes`, `likes_write_own` ist `for all`, und ihr `with check`
verlangt vom Zielbeitrag nur, dass er **existiert** — nicht, dass er sichtbar
ist. „Reagieren auf A · Zeile auf B schieben · zurücknehmen" lässt A dauerhaft
zu hoch stehen und treibt **B ins Negative**, auf einem Beitrag, den der
Angreifer nicht sehen muss. Ohne den geplanten Zähler heute folgenlos.

## Decisions

- **Zwei Changes, Umfragen separat.** *Warum:* §5 ist als einziger Teil ein
  eigenes Datenmodell und hängt an keinem anderen Teil außer einem Knopf im
  Composer. Vor dem Go-Live ist das der Unterschied zwischen „etwas ist fertig"
  und „nichts ist fertig".
- **Eine Umfrage bleibt ein `kind='member'`-Beitrag**, `poll_options`/
  `poll_votes` hängen über `post_id`. *Warum:* `posts_kind_ref_id_check` bindet
  `event ⇔ ref_id gesetzt` und `member ⇔ ref_id leer`; eine Umfrage passt in
  keine der beiden Hälften, und `kind` bedeutet ohnehin „wer darf schreiben".
- **Umfrage mit Ende; bis dahin sieht das Ergebnis nur, wer abstimmte, danach
  alle.** *Warum:* ohne Ende sähe ein Nichtwähler es nie.
- **Bereichsfarben: die bestehende Anforderung wird MODIFIZIERT, nicht
  umgangen.** *Warum:* `design-system` sagt wörtlich „Blue SHALL be the only
  accent family … SHALL NOT define … a per-format accent palette", mit
  prüfendem Szenario. Die neue Grenze: **interaktiver** Akzent bleibt Blau
  allein; eine zweite Familie darf nur einen Bereich **identifizieren** und nie
  an Link, Knopf, Fokusring oder aktivem Zustand erscheinen.
- **Bereichs-Tokens werden EINMAL definiert, nicht je Theme.** *Warum:* sie sind
  Inhaltsschicht, und dieselbe Anforderung verlangt dort identische Werte in
  beiden Themes — der navy-Block überschreibt absichtlich nur Chrome. Meine
  erste Formulierung („im dunklen Block zufällig richtig") war schlicht falsch.
- **Die zwei Aggregat-Funktionen werden `security invoker`, nicht `definer`.**
  *Warum:* sie aggregieren nur, was der Aufrufer ohnehin sehen darf. Unter
  `invoker` stimmt die Zahl, **weil die Regel wirkt** — nicht, weil eine
  Abschrift sie nachspricht. Spart die vierte und fünfte Kopie des Prädikats.
- **`post_likes` verliert UPDATE.** *Warum:* eine Reaktion hat keinen
  Änderungsfall; sie entsteht und vergeht. Der Client schreibt nur `upsert` und
  `delete` — das Recht ist schon heute unbenutzt.
- **`posts` verliert INSERT ganz.** *Warum:* `create_post_with_media` ist
  `security definer`, und `from("posts")` steht fünfmal im Quelltext — dreimal
  lesend, einmal `update`, einmal `delete`. Kein Weg benutzt es.
- **Sortierung: echter Umschalter inkl. „Beliebteste".** Donalds Wahl, und die
  teuerste — sie erzwingt den materialisierten Zähler und damit beide
  Rechte-Entzüge.
- **Fünf aktivste Mitglieder, gezählt nach Beiträgen; Reiter NICHT in der URL.**
- **Der Icon-Satz trägt nur wiederverwendbare Glyphen.** *Warum:* „kein `<svg>`
  außerhalb des Satzes" war gegen den Baum falsch und stand gegen die
  bestehende Anforderung an die Markenmarke. Ausnahmen namentlich benannt.

## Files modified

- `openspec/changes/activity-concept-level/proposal.md` — **neu**
- `openspec/changes/activity-concept-level/design.md` — **neu**, acht
  Entscheidungen mit verworfenen Alternativen
- `openspec/changes/activity-concept-level/specs/community-feed/spec.md` —
  **neu**, 14 Anforderungen (12 ADDED, 2 MODIFIED)
- `openspec/changes/activity-concept-level/specs/design-system/spec.md` —
  **neu**, 5 Anforderungen, davon die MODIFIED gegen „Blue only"
- `openspec/changes/activity-concept-level/tasks.md` — **neu**, 77 Aufgaben
- `openspec/changes/activity-concept-level/REVIEWS.md` — **neu**, jeder Befund
  mit BESTÄTIGT/WIDERLEGT und Auflösung
- `session-handoff.md` — diese Datei

Untracked und **absichtlich nicht committet**: `scripts/chat-testkonten.ts`
(AGE-583, Chat-Testkonten gegen den lokalen Stack, aus einer früheren Sitzung).

## Next session: start here

**Erste Handlung: Abschnitt 1 der Aufgabenliste bauen** (Icon-Satz), weil alles
andere daran hängt — und darin zuerst 1.7/1.8: der erzwingende Test **mit
Gegenprobe**, sonst ist er eine Absicht statt eines Mechanismus. Der Branch
`donald/age-582-aktivitaet-auf-konzeptstand` ist gepusht, PR #205 offen, der Bau
läuft auf demselben Branch weiter.

Alternative, falls die Entscheidungen frisch bleiben sollen: **Change B
(Umfragen) als Plan danebenlegen**, solange Laufzeit, Sichtbarkeit und
Datenmodell entschieden sind. Das kostet eine Sitzung und blockiert Change A
nicht.

Vor dem Bau von Abschnitt 3 gilt die Reihenfolge in den Aufgaben **wörtlich**:
erst der rote pgTAP zum Verschiebe-Angriff (3.2), dann der Entzug (3.3) — und
erst dann der Zähler. Ein Zähler vor dem Entzug ist eine Einladung.

## Open questions

- **Farbwerte der sieben Bereiche und das Kontrastziel.** „Erkennbar" ist nicht
  abnehmbar; die Zahl entsteht beim Bau von Abschnitt 1.
- **PostgREST-Form des Typfilters** (Anti-Join für „Text", Inner-Join für
  „Bild"). Belegt nur ein Integrationstest gegen den lokalen Stack.
- **Der Aktivierungsversand steht weiter aus** — 69 der 72 PROD-Konten sind
  nicht aktiviert, und `app.fairbusinessclub.de` hat **weiter keinen
  DNS-Eintrag**. Das ist der Go-Live-Punkt und deine Entscheidung.
- **Das Onlinetreffen ist am 25.08.**, also morgen.
- Unverändert offen aus der siebzehnten Sitzung: drei abweichende
  Anmeldeadressen · ein echter Mitgliedsname in der Git-Historie · Rotation des
  PROD-DB-Passworts · vier Review-Befunde aus 11.5 (HIGH-2 Zeilensperre vor dem
  GoTrue-Aufruf, `event_attendees`-RPC ohne Paging, Draft = Server-Baseline,
  zwei pgTAP-Zusagen vor ihrem Fixture) · 7.5 halb · kein Nachsetz-Weg für eine
  gelöschte Zeile ohne Ban · `grund` ohne Aufrufer · `admin_audit.actor` ohne
  `on delete cascade` · Downgrade (AGE-516) · `admin_list_feedback()` ohne
  Paging · **DEV ist nicht mitgepflegt** (eines der elf deaktivierten Konten ist
  dort `matching_manager`).
