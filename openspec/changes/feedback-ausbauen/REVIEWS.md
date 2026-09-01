# Change review — feedback-ausbauen (AGE-628)

Zwei Prüfer, beide **nicht** der bauende Anbieter (`claude`). Gefahren am
2026-09-01 über `~/.agenticapps/bin/reviewer-cli.sh` mit `REVIEWER_TIMEOUT=900`,
beide Exit 0. Der Prompt umfasste Proposal, Design, Tasks und beide Spec-Deltas
(857 Zeilen, SHA-256
`69b8af1a68da5055c6fb4e8d69cee1585d8736cb344b81d35228ecb647d3c27e`).

**Beide Verdikte: REQUEST-CHANGES.** Der Change wird vor dem ersten Code
überarbeitet.

> **Zur Herkunft dieser Datei:** von Hand geschrieben, weil die Prüfer direkt
> über den Wrapper liefen und nicht über `run-plan-review.sh`. Der Trailer folgt
> dessen Grammatik; der `digest` ist **nicht** erfunden, sondern mit den
> Funktionen `digest_set`/`compute_digest` aus `openspec-change-gate.sh` selbst
> berechnet.
>
> **Der Trailer-`digest` zeigt auf die ÜBERARBEITETEN Artefakte, nicht auf die
> geprüften.** Er sagt „diese Review ist für diesen Stand aktuell", nicht „das
> haben die Prüfer gesehen". Was sie gesehen haben, steht oben als SHA-256 des
> Prompts (`69b8af1a…`) und war die erste Fassung. Beides auseinanderzuhalten
> ist der Punkt: die Überarbeitung ist die Antwort auf die Review, nicht ihr
> Gegenstand.
>
> **Laufzeit, weil es die nächste Runde plant:** `gemini` war in gut einer
> Minute durch und hat den Text bewertet. `codex` brauchte **knapp 13 Minuten
> und 22 Werkzeugaufrufe** — er hat `git log` gefahren, Migrationen und
> Testdateien geöffnet und die Behauptungen gegen den Bestand geprüft. Genau
> daher kommen die acht HIGH-Befunde. Er legt dabei `.change-review-prompt.tmp.md`
> im Arbeitsbaum ab; die Datei ist untracked und gehört hinterher weg.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

[HIGH] spec delta feedback-qm — Die Szenarien zum Löschen des Bildes seien
unvollständig; es fehle der Fall „authentifiziertes Nicht-Admin-Mitglied, das
nicht der Verfasser ist". — Szenario ergänzen.

[LOW] tasks 1.1 — „Grants aussprechen" benennt die Grants nicht. — `select` für
`authenticated` ausschreiben.

[LOW] design 4 / tasks 3.2 — Die fünf bestehenden argumentlosen Zusagen
verlassen sich nach der Änderung stillschweigend darauf, dass `null` weiterhin
„kein Filter" bedeutet. — Im Entwurf benennen.

Angenommene, aber nicht ausgesprochene Voraussetzungen: dass `FilterSpalte` ohne
Umbau für die neuen Filtertypen taugt; dass Migrationen zuverlässig vor dem
Frontend ausgerollt werden; dass die gefilterte Abfrage ohne neuen Index schnell
genug bleibt.

## Reviewer: codex

VERDICT: REQUEST-CHANGES

[HIGH] messaging / „Sending requires an accepted contact request" — Die Ausnahme
erzeugt einen **einseitigen Chat**: der Admin darf senden, der Feedback-Geber
kann nicht antworten und bekommt „Nachricht nicht gesendet". — Entweder als
einseitig ausweisen oder ein vom Admin eröffnetes Gespräch modellieren, in dem
**beide** senden dürfen, samt Szenario für die Antwort.

[HIGH] design 6 / tasks 4.2 — `messages_insert` enthält **keine eigenständige**
Kontaktanfrage-Prüfung. Das einzige `EXISTS` belegt zugleich die Teilnahme am
Gespräch. Wer den ganzen Ausdruck in `(… or is_admin())` klammert, erlaubt einem
Admin das Schreiben in **fremde** Gespräche — das Gegenteil dessen, was das
Proposal zusagt. — Vollständiges Ersatz-SQL angeben, Teilnahmeprüfung getrennt
halten, Ausnahme nur auf die Annahme-Bedingung.

[HIGH] tasks 7.7 / messaging „One thread per member pair" — Die Gesprächsanlage
ist undefiniert und widerspricht der unveränderten Zusage, Gespräche entstünden
serverseitig bei Annahme. Die Datenbank hat nur `UNIQUE(a,b)`, **keine**
Normalisierungs-Bedingung — vertauschte Paare können koexistieren, und
Select-dann-Insert hat ein Wettrennen. — Atomaren serverseitigen Weg definieren,
der normalisiert, Konflikt behandelt, die Kennung zurückgibt und Selbstgespräche
abweist.

[HIGH] design 2 / tasks §1 — `theme` wird `not null` **ohne Default**. Das
laufende Frontend, zwischengespeicherte Clients, Seeds und bestehende SQL-Tests
schicken kein `theme`; „Migrationen vor Frontend" bricht damit sofort. —
`default 'generell'` setzen, und Anlegen/Backfill/FK/Default/`not null` je
einzeln als Aufgabe mit Test.

[HIGH] design 8 / tasks 2.3b, 7.5 — Das Löschrecht ist zugesagt, aber es gibt
keine Bedienung dafür, und das Löschen des Objekts lässt `feedback.screenshot_path`
ins Leere zeigen — während der Admin fremde Feedback-Zeilen absichtlich nicht
ändern darf. — Bedienung ergänzen und einen eng autorisierten Weg, der den
Verweis mit aufräumt; das Non-Goal entsprechend schärfen.

[HIGH] design 5 / tasks 2.2–2.3b — `screenshot_path` ist an nichts gebunden —
weder an den Verfasser noch an ein existierendes Objekt. Ein Mitglied kann seine
Zeile auf einen fremden Pfad zeigen lassen; die Admin-Fläche signiert oder
löscht dann das falsche Objekt (_confused deputy_). — Eigentümer-Präfix für
nicht-leere Pfade erzwingen, möglichst ein Objekt je Feedback, und über die
geprüfte Feedback-Identität löschen statt über einen vom Client gelieferten Pfad.

[HIGH] tasks 7.2–7.4 / `src/lib/feedback.ts` — Der React-Query-Schlüssel enthält
**nur die Seite** (`adminFeedbackQueryKey(seite)`). Ein Filterwechsel auf
derselben Seite liefert veraltete Ergebnisse; wer auf Seite 3 steht und den
Filter verengt, sieht fälschlich „keine Treffer", obwohl Seite 1 welche hat. —
Filter kanonisiert in den Schlüssel, Blätterung beim Filterwechsel zurücksetzen,
beides testen.

[HIGH] tasks 2.3, 2.3b / Sicherheit — Die Speicher-Prädikate sagen
Eigentümer-oder-`is_admin()` **ohne** `is_activated()`. Ein deaktiviertes Konto
mit noch gesetzter Admin-Rolle könnte Screenshots lesen und löschen — anders als
bei `feedback_admin_read`. — `is_activated() and (Eigentümer or is_admin())`,
und einen deaktivierten Admin testen.

[MEDIUM] design Kontext 2 / tasks 3 — Die Bestandsaufnahme der
RPC-Abhängigkeiten ist unvollständig: neben den fünf argumentlosen Aufrufen
stehen **zwei** exakte `admin_list_feedback(int,int)`-Bezüge in `rls_test.sql`
und **drei weitere** in `admin_feedback_test.sql`. — Alle fünf heben.

[MEDIUM] design 5 / tasks 2.1, 6.2 — Bucket-Name, Byte-Grenze, MIME-Typen,
Umwandlung und Lebensdauer der signierten URL sind unbestimmt. `post-media`
wörtlich zu kopieren hiesse 1 MiB und **nur WebP** — gewöhnliche
PNG-Screenshots fielen durch.

[MEDIUM] tasks 1.1 — Zu `feedback_themes` fehlen RLS-Aktivierung, Lese-Policy
und die genauen Rollen. Mit RLS ohne Policy sieht die Oberfläche eine leere
Liste; ohne RLS bricht es die Hauskonvention.

[MEDIUM] proposal Frontend / tasks 5.1 — `src/types/database.types.ts` gibt es
nicht; die handgepflegte Datei ist **`src/lib/database.types.ts`**.

[MEDIUM] design 3 / tasks 3.4, 7.2 — Nur das Themen-Prädikat ist angegeben. Das
Bewertungs-Prädikat fehlt, und „Mehrfachauswahl als ODER" sagt nicht, wie Thema
und Bewertung **untereinander** verknüpft sind.

[MEDIUM] tasks §§1–7 — Die Reihenfolge stellt Migration und Umsetzung vor die
Tests, gegen die verbindliche RED-vor-GREEN-Regel des Repos. Mehrere
Spec-Szenarien haben gar keine Testaufgabe.

[MEDIUM] proposal Non-Goals — `profile_id not null` belegt nur, dass eine
Profilzeile existiert. Es belegt **nicht**, dass der Verfasser ein anderer ist
als der prüfende Admin, noch dass sein Konto aktiv ist. — Verhalten für
selbstverfasstes Feedback und für deaktivierte/gelöschte Verfasser festlegen.

[LOW] design Open Questions — „Ein Thema hinzufügen kostet eine Zeile, keine
Migration" widerspricht dem migrationsgeführten Datenmodell. — Es ist eine
Daten-Migration, nur kein Frontend-Deploy.

[LOW] Migration Plan — Für den neuen gefilterten Zugriffsweg ist kein Index
geplant; `feedback` hat heute nur einen auf `profile_id`.

Angenommene, aber nicht ausgesprochene Voraussetzungen (Auszug): dass ein Chat
einseitig sein darf; dass Donalds Entscheidung für **jedes** Admin/Mitglied-Paar
gilt statt nur für Antworten an Feedback-Geber; dass alte und
zwischengespeicherte Frontend-Fassungen die Migration nicht überleben müssen;
dass Screenshots mit personenbezogenen Daten eine geklärte Aufbewahrungs- und
Moderationsregel haben.

## Not counted

Keiner. Beide Prüfer lieferten Exit 0 innerhalb der Zeitgrenze.

## Resolution

**Nachgemessen statt geglaubt.** Jeder prüfbare Befund von `codex` wurde vor der
Annahme selbst gemessen, und **jeder hielt stand**:

| Befund                                       | Gegenprobe                                                           |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `messages_insert` klammert Teilnahme mit ein | bestätigt an `20260806080100_activation_gate.sql:358-370`            |
| Typdatei liegt woanders                      | bestätigt: `src/lib/database.types.ts` existiert, `src/types/` nicht |
| Fünf exakte Signatur-Bezüge                  | bestätigt: 2 in `rls_test.sql`, 3 in `admin_feedback_test.sql`       |
| Query-Schlüssel trägt nur die Seite          | bestätigt: `AdminFeedbackPage.tsx:94`                                |

**Angenommen und einzuarbeiten** — alle acht HIGH und alle MEDIUM ausser dem
unten genannten. Der schwerwiegendste ist der zweite: mein Entwurf sagte, die
Teilnahmeprüfung bleibe „unangetastet", während sie in Wahrheit **innerhalb**
des Ausdrucks steht, den ich klammern wollte. Umgesetzt hätte das einem Admin
das Schreiben in jedes fremde Gespräch erlaubt — das genaue Gegenteil der
zugesagten engen Ausnahme.

**Nicht angenommen:** Geminis HIGH-Befund. Das verlangte Szenario steht bereits
im Delta als „Ein Fremder kann das Bild nicht löschen" — es benennt
ausdrücklich „ein authentifiziertes Mitglied ohne Admin-Rolle" und „ein
**fremdes** Feedback", also genau den Fall. Kein Diff.

**Bereits vor dem Review selbst gefunden und eingearbeitet** (Commit `2d5bc75`):
die zwei Signatur-Bezüge in `rls_test.sql`. `codex` hat die Zählung dann
vervollständigt — es sind fünf, nicht zwei, weil ich nur in einer Datei gesucht
hatte statt im Verzeichnis. Derselbe Fehler, den `~/Sourcecode/CLAUDE.md` für
entfernte Werkzeuge beschreibt: erst den Raum absuchen, dann die Begriffe.

**Geht an Donald, weil es eine Produktfrage ist:** der einseitige Chat. „Sprung
in den Chat mit der Person" liest sich wie ein Gespräch, nicht wie eine
Durchsage — aber ein Gespräch, in dem beide senden dürfen, ist eine **zweite**
Ausnahme und nicht die, die am 01.09. entschieden wurde. Sie wird gestellt,
nicht gebaut.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:e14087835b3f295ee888faab35170493a7d2ca73b162f2ce0749ea69d5434dd4
producer-version: 1.2.0
tasks-digest: sha256:4a301ab81a1c0a069d7b8b7d67b15138bd3ec6a87896479b42f3b57862133f03
-->
